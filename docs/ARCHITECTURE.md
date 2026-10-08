# ARCHITECTURE — Aplikasi Kasir / POS

**Status:** Target architecture (disetujui untuk implementasi bertahap per milestone)
**Referensi:** PRD v1.0 §45, §46, §51 · Keputusan rinci: `DECISIONS.md`

> Prinsip: **Frontend menangani UX. Backend menjadi sumber kebenaran business rule.
> PostgreSQL menjaga konsistensi data. Audit trail menjaga keterlacakan.**

---

## 1. System Overview

```
┌────────────────────────┐
│  React Native (mobile/) │  POS kasir, master data, laporan (baca)
└────────────┬───────────┘
             │ REST /api/v1 (JSON, JWT)
┌────────────▼───────────┐
│  Spring Boot (backend/) │
│  auth · sales · inventory · purchase · cashier · report · approval · audit │
└────────────┬───────────┘
             │ JDBC
┌────────────▼───────────┐
│  PostgreSQL 16 + Flyway │
└────────────────────────┘
```

---

## 2. Monorepo Layout

```
tugas-kuliah-001/
├── mobile/                  # React Native 0.87.1 (TypeScript)
│   └── src/
│       ├── app/             # navigation, providers
│       ├── modules/         # auth, pos, products, inventory, purchase,
│       │                    # customers, suppliers, cashier, reports, settings
│       ├── components/      # shared UI
│       ├── services/        # api client
│       ├── stores/          # state (auth, cart)
│       ├── hooks/ utils/ types/
├── backend/                 # Spring Boot (lihat §3)
├── docs/                    # assessment, arsitektur, backlog, keputusan
└── README.md
```

---

## 3. Backend Module Structure

`backend/src/main/java/com/tugaskuliah/pos/` — modular per domain (PRD §45):

```
├── auth/  user/  role/  permission/  store/
├── product/  category/  unit/  customer/  supplier/
├── sales/  payment/  cashier/  inventory/  purchase/
├── approval/  report/  notification/  audit/
└── common/
    ├── config/        # security, jackson, cors, datasource
    ├── exception/     # GlobalExceptionHandler, error codes
    ├── response/      # ApiResponse<T> envelope
    ├── security/      # JWT filter, permission evaluator
    ├── util/          # numbering, money
    └── audit/         # audit aspect/helper
```

Setiap domain (bila relevan) punya: `controller`, `service`, `repository`,
`entity`, `dto`, `mapper`, `validation`. Business rule **hanya** di service/domain.

### 3.1 Tech choices (final)

| Aspek | Pilihan | Alasan |
|---|---|---|
| Framework | Spring Boot 3.x | Standar PRD; ekosistem matang |
| Java | 21 (LTS) | LTS terbaru; virtual threads opsional |
| Build | Maven | Umum di kurikulum; build reproducible |
| ORM | Spring Data JPA + Hibernate | Produktivitas; tetap kontrol via query |
| Migration | Flyway | Wajib PRD; versioned SQL |
| Auth | Spring Security + JWT (access + refresh) | Stateless; cocok untuk mobile |
| Password | BCrypt | Wajib PRD §6 |
| Validation | Bean Validation (jakarta.validation) | Deklaratif di DTO |
| Mapping | MapStruct | Mengurangi boilerplate entity↔DTO |
| Test | JUnit 5 + Mockito + Testcontainers (PostgreSQL) | Integration test realistis |
| Money | `BigDecimal`, kolom `NUMERIC(19,2)` | Anti floating-point (PRD §10) |
| Logging | SLF4J + Logback (JSON layout opsional) | Observability (PRD §25) |

### 3.2 API conventions

- Base path: `/api/v1/...`
- Response envelope (PRD §32):

```json
{ "success": true, "message": "...", "data": {}, "paginated": { "page": 0, "size": 20, "totalElements": 100, "totalPages": 5 } }
```

- Error: `{ "success": false, "message": "Stock is insufficient", "data": null }`
  dengan HTTP status semantik (400 validation, 401 auth, 403 forbidden, 404 not found,
  409 conflict/concurrent, 422 business rule).
- List endpoint: `page`, `size`, `sort`, `search`, `filter` — **server-side only** (PRD §33).
- Global exception handler: pesan informatif, tanpa stack trace / secret bocor (PRD §24).

### 3.3 Auth & RBAC design

- `POST /api/v1/auth/login` → access token (15 mnt) + refresh token (7 hari, rotation).
- Permission model: `resource.action` (mis. `sales.create`, `stock.adjustment`).
- Proteksi di backend: method security (`@PreAuthorize("hasAuthority('sales.create')")`).
- Menu mobile di-filter berdasar permission user, tapi **backend tetap otoritas final**.
- User nonaktif → login ditolak; password tidak pernah plaintext.

### 3.4 Concurrency & numbering

- **Stok:** `stock_balances` sebagai cache; update via
  `UPDATE ... SET qty = qty + :delta WHERE product_id = :id` dalam satu transaksi,
  atau `SELECT ... FOR UPDATE` pada baris balance sebelum validasi. Setiap perubahan
  **wajib** menulis `stock_movements` (ledger) di transaksi yang sama.
- **Nomor dokumen** (`INV-YYYYMMDD-000001`): tabel `document_counters`
  (`prefix`, `date`, `last_number`) dengan row-level lock per hari → anti duplikat concurrent.
- **Double submit:** idempotency key di header pada `POST /sales` (opsional MVP, direkomendasikan).

---

## 4. Database — ERD Inti (PostgreSQL)

Konvensi: PK `id BIGSERIAL/BIGINT`, FK jelas, `NOT NULL` untuk field wajib,
`created_at/updated_at`, `created_by/updated_by` untuk master data.
Index pada: sku, barcode, nomor dokumen, tanggal transaksi, FK, status, `audit_logs(entity_type, entity_id)`.

```
users ──< role_permissions >── roles ──< ── permissions
  │                 (users_roles join)
  ├──< sales ──< sale_items >── products ──< product_variants
  │        ├──< sale_payments >── payment_methods
  │        └──< sales_returns ──< sales_return_items
  ├──< cashier_shifts ──< cash_movements
  ├──< purchases ──< purchase_items
  │        └──< goods_receipts ──< goods_receipt_items
  ├──< stock_movements >── products
  ├──< stock_adjustments, stock_opnames ──< stock_opname_items
  ├──< approvals
  └──< audit_logs
products ──< product_prices (histori harga, valid_from/valid_to)
products ── categories, units
customers, suppliers (master)
```

Tabel inti & constraint penting:

| Tabel | Kunci / constraint penting |
|---|---|
| `users` | `username` UNIQUE, `is_active`; password hash BCrypt |
| `roles`, `permissions`, `role_permissions` | `permissions(code)` UNIQUE (`sales.create`) |
| `products` | `sku` UNIQUE, `barcode` UNIQUE (nullable), `is_active` |
| `product_prices` | histori: `valid_from`, `valid_to`; hanya 1 harga aktif per produk |
| `sales` | `invoice_no` UNIQUE, `status` (DRAFT→COMPLETED→VOIDED/REFUNDED…), FK `shift_id`, `customer_id`, `cashier_id` |
| `sale_items` | menyimpan **harga saat transaksi** (`unit_price`) — imun terhadap perubahan master |
| `sale_payments` | `SUM(amount) >= grand_total` divalidasi di service |
| `cashier_shifts` | 1 shift aktif per kasir (`UNIQUE` partial pada `closed_at IS NULL`); `expected_cash` dihitung backend |
| `stock_movements` | `movement_type` enum (PURCHASE/SALE/…), `qty` signed, `reference_type` + `reference_id` wajib |
| `stock_balances` | `UNIQUE(product_id, store_id)`; cache dari ledger |
| `purchases` | `po_no` UNIQUE, status DRAFT→…→RECEIVED; PO **tidak** menambah stok |
| `goods_receipts` | penerimaan (bisa parsial) → menambah stok via movement |
| `approvals` | `requester_id`, `approver_id`, `reason`, status REQUESTED→APPROVED/REJECTED, timestamps |
| `audit_logs` | append-only: `user_id, action, entity_type, entity_id, old_value, new_value, reason, ip, created_at`; **tanpa** endpoint update/delete |

Full DDL dituangkan sebagai migration Flyway per milestone (mulai Phase 1).

---

## 5. Role–Permission Matrix (default)

| Permission group | OWNER | ADMIN | SUPERVISOR | KASIR | GUDANG | PURCHASING | ACCOUNTING |
|---|---|---|---|---|---|---|---|
| `user.*` | ✅ | ✅ | — | — | — | — | — |
| `product.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `product.create/update`, `product.price.update` | ✅ | ✅ | ✅ | — | — | — | — |
| `sales.view/create` | ✅ | ✅ | ✅ | ✅ | — | — | ✅ |
| `sales.void/return/refund` | ✅ | — | ✅ | request* | — | — | — |
| `sales.discount` | ✅ | ✅ | ✅ | terbatas** | — | — | — |
| `stock.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `stock.adjustment/opname/transfer/receive` | ✅ | — | ✅ | — | ✅ | — | — |
| `purchase.view/create` | ✅ | ✅ | ✅ | — | — | ✅ | ✅ |
| `purchase.approve` | ✅ | — | ✅ | — | — | — | — |
| `purchase.receive` | ✅ | — | ✅ | — | ✅ | ✅ | — |
| `shift.open/close`, `cash.in/out` | ✅ | — | ✅ | ✅ | — | — | ✅ |
| `cash.reconcile` | ✅ | — | ✅ | ✅ | — | — | ✅ |
| `approval.approve/reject` | ✅ | — | ✅ | — | — | — | — |
| `report.*` | ✅ | ✅ | ✅ | — | — | — | ✅ |

\* Kasir mengajukan void/return → butuh approval Supervisor (PRD §13–14).
\** Batas diskon kasir dikonfigurasi; di atas batas → approval (PRD §15).

---

## 6. Frontend Structure (mobile/)

Mengikuti PRD §46:

```
mobile/src/
├── app/            # navigation (React Navigation), providers
├── modules/
│   ├── auth/       # login, session
│   ├── pos/        # cart, hold, payment, receipt
│   ├── products/ categories/ units/
│   ├── inventory/  # stock, movement, adjustment, opname
│   ├── purchase/   # PO, goods receipt, return
│   ├── customers/ suppliers/
│   ├── cashier/    # open shift, current shift, cash movement, close shift
│   ├── transactions/ # history, detail, void, return/refund
│   ├── approval/ reports/ audit/ settings/ dashboard/
├── components/ layouts/
├── services/       # api client (axios), auth interceptor, token refresh
├── stores/         # Zustand: authStore, cartStore
└── hooks/ utils/ types/
```

Keputusan frontend: **React Navigation + Zustand + axios**. Business rule tidak di frontend;
frontend: UX, validasi form, loading/empty/error state, cegah double submit, keyboard/barcode friendly.

---

## 7. Non-Functional

- **Performance:** pagination server-side; index pada kolom filter; hindari N+1 (fetch join /
  entity graph); agregasi laporan di DB.
- **Security:** checklist PRD §23 — tidak ada secret di source code (env), rate limit endpoint
  sensitif (login), validasi input di semua layer.
- **Reliability:** transaksi finansial/inventory selalu dalam DB transaction; Flyway untuk
  semua perubahan schema; backup PostgreSQL berkala (operasional).
- **Observability:** structured logging, health check (`/actuator/health`), request ID di log.

---

## 8. Keputusan Arsitektur Kunci

| ID | Keputusan | Rasional |
|---|---|---|
| A1 | Monorepo `mobile/` + `backend/` + `docs/` | Satu repo tugas; deploy terpisah |
| A2 | Stock = ledger (`stock_movements`) + cache (`stock_balances`) | PRD §5.3; auditability + performa |
| A3 | Harga histori (`product_prices`), snapshot harga di `sale_items` | Struk & laporan imun terhadap perubahan harga |
| A4 | PO tidak menambah stok; goods receipt yang menambah | PRD §21.2 |
| A5 | Shift wajib untuk checkout (configurable) | Kontrol kas (PRD §11) |
| A6 | Audit log append-only | PRD §14 |
| A7 | Semua nilai authoritative dihitung backend | PRD §23 (grandTotal, expectedCash, dsb.) |

Rincian & asumsi lain: `docs/DECISIONS.md`.
