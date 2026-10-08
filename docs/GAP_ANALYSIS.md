# GAP ANALYSIS — PRD vs Repository

**Metode:** `PRD Requirement → Existing Code → Gap → Required Change`
**Tanggal:** 2026-10-08

Repo adalah greenfield (hanya template RN). Hampir semua item berstatus
**NEEDS NEW IMPLEMENTATION** — dokumen ini menegaskan tidak ada duplikasi konsep
yang perlu dihindari dan menandai item yang butuh keputusan.

---

## Ringkasan Status

| Status | Jumlah domain | Keterangan |
|---|---|---|
| ALREADY EXISTS | 1 (parsial) | Scaffold RN + tooling dasar |
| NEEDS MODIFICATION | 1 | Struktur repo → monorepo (sudah dikerjakan) |
| NEEDS NEW IMPLEMENTATION | 9 phase penuh | Seluruh domain bisnis + backend + DB |
| NOT NEEDED (MVP) | — | Lihat "Could Have" PRD §40 |
| BLOCKED / NEEDS DECISION | 4 item | Lihat tabel bawah |

---

## ALREADY EXISTS

| PRD Requirement | Existing Code | Gap | Required Change |
|---|---|---|---|
| Frontend RN + TypeScript (PRD §1, §38) | `mobile/` RN 0.87.1, TS, Jest, ESLint | Tidak ada navigation, state, API client | Tambah di Phase 0/1: React Navigation, Zustand, axios |
| Struktur modular frontend (PRD §46) | Belum ada | Folder `src/modules/*` kosong | Dibuat bertahap per milestone |

## NEEDS MODIFICATION

| PRD Requirement | Existing Code | Gap | Required Change |
|---|---|---|---|
| Monorepo backend+frontend (§51) | Repo root = project RN | Backend butuh lokasi sendiri | ✅ Dikerjakan: RN → `mobile/`; `backend/`, `docs/` dibuat |

## NEEDS NEW IMPLEMENTATION

### Phase 0 — Foundation

| PRD Requirement | Existing | Gap → Change |
|---|---|---|
| Spring Boot + PostgreSQL + Flyway (§1, §37, §44) | Tidak ada | Setup `backend/` (Maven, Java 21), docker-compose Postgres, Flyway baseline |
| Common response & exception handling (§24, §32) | Tidak ada | `ApiResponse<T>`, `GlobalExceptionHandler` |
| Logging & health check (§25, §37) | Tidak ada | Logback, `/actuator/health`, request ID |

### Phase 1 — Auth & RBAC (§4, §6)

| PRD Requirement | Existing | Gap → Change |
|---|---|---|
| users, roles, permissions, role_permissions | Tidak ada | Migration + entity + seed 7 role (PRD §44) |
| Login/logout/refresh, BCrypt, user aktif/nonaktif | Tidak ada | Spring Security + JWT; `auth/*` endpoints |
| Permission `resource.action` + proteksi endpoint | Tidak ada | `@PreAuthorize` + permission evaluator |
| Menu mobile mengikuti permission | Tidak ada | `authStore` + guard di navigation |

### Phase 2 — Master Data (§7)

| PRD Requirement | Existing | Gap → Change |
|---|---|---|
| Category (parent opsional), Unit | Tidak ada | CRUD + pagination + search |
| Product: SKU unique, barcode unique, is_active | Tidak ada | CRUD + validasi; produk inactive tidak bisa dijual |
| Product variant & barcode | Tidak ada | Tabel `product_variants`, `barcodes` |
| Price history (`product_prices`) | Tidak ada | Histori valid_from/valid_to; 1 harga aktif |
| Customer (+GENERAL CUSTOMER default), Supplier | Tidak ada | CRUD + seed customer default |
| Payment methods (CASH, QRIS, DEBIT, …) | Tidak ada | Tabel konfig + seed |

### Phase 3 — POS / Sales (§8–10, §34–35)

| PRD Requirement | Existing | Gap → Change |
|---|---|---|
| Cart, hold/resume, barcode search | Tidak ada | `cartStore` (Zustand); hold = sale status HELD (tanpa potong stok) |
| Checkout atomik 10 langkah (§34) | Tidak ada | `@Transactional` sale service: validasi shift→produk→harga→stok→sale→items→payment→movement→balance→audit |
| Split payment, `SUM(amount) >= total`, kembalian | Tidak ada | Validasi di service; backend hitung ulang total |
| Invoice unik concurrent (`INV-YYYYMMDD-nnn`) | Tidak ada | `document_counters` + row lock |
| Snapshot harga di `sale_item` | Tidak ada | Kolom `unit_price` per item |
| Receipt (print/reprint/preview) | Tidak ada | Layar receipt; print = Could Have |

### Phase 4 — Cashier Shift (§11–12)

| PRD Requirement | Existing | Gap → Change |
|---|---|---|
| Open shift + opening cash; 1 shift aktif/kasir | Tidak ada | `cashier_shifts`; partial unique index |
| Cash in/out dengan reason & reference | Tidak ada | `cash_movements` |
| Close shift: expected cash **dihitung backend** | Tidak ada | Formula PRD §11.3 di service; variance + threshold approval |
| Checkout wajib shift aktif (configurable) | Tidak ada | Validasi di sale service |

### Phase 5 — Inventory (§17–20)

| PRD Requirement | Existing | Gap → Change |
|---|---|---|
| `stock_movements` ledger (10 tipe) + referensi | Tidak ada | Enum movement type; `reference_type/id` wajib |
| `stock_balances` cache konsisten | Tidak ada | Update atomik dalam transaksi yang sama |
| Low stock / out of stock; negative stock configurable | Tidak ada | Query + config `allow_negative_stock` |
| Adjustment beralasan (+approval sensitif) | Tidak ada | `stock_adjustments` |
| Stock opname: snapshot → count → diff → approval → adjustment | Tidak ada | `stock_opnames` + items (Should Have MVP) |

### Phase 6 — Purchase (§21–22)

| PRD Requirement | Existing | Gap → Change |
|---|---|---|
| PO: DRAFT→…→RECEIVED; **tidak** menambah stok | Tidak ada | `purchases` + items; approval flow |
| Goods receipt parsial → movement PURCHASE | Tidak ada | `goods_receipts` + items |
| Purchase return → stock out + penyesuaian hutang | Tidak ada | `purchase_returns` (Should Have) |
| Supplier payable UNPAID→PAID (struktur disiapkan) | Tidak ada | Tabel payable disiapkan; full flow opsional |

### Phase 7 — Control (§13–14, §26)

| PRD Requirement | Existing | Gap → Change |
|---|---|---|
| Void: request → reason → approval → VOIDED | Tidak ada | Status lifecycle; tanpa hard delete |
| Return/refund: referensi invoice asal, kondisi SELLABLE/DAMAGED | Tidak ada | `sales_returns` + items; movement SALES_RETURN |
| Approval workflow (requester/approver/reason/status) | Tidak ada | `approvals`; bukan boolean |
| Audit log append-only (LOGIN…APPROVAL) | Tidak ada | `audit_logs`; tanpa endpoint mutasi |

### Phase 8 — Dashboard/Reports/Notification (§24–25, §27)

| PRD Requirement | Existing | Gap → Change |
|---|---|---|
| Sales/inventory/cash/purchase/profit report + filter | Tidak ada | Query agregasi DB; pagination |
| Dashboard KPI + alert (low stock, shift terbuka, approval pending) | Tidak ada | Endpoint agregasi ringan |
| Notifikasi in-app | Tidak ada | `notifications` (Should Have) |

### Phase 9 — Hardening (§22, §23, §37)

| PRD Requirement | Existing | Gap → Change |
|---|---|---|
| Index review, N+1, slow query | Tidak ada | Review setelah MVP |
| Security checklist | Tidak ada | Verifikasi per milestone |

---

## NOT NEEDED (di luar MVP — PRD §40–41)

Multi-store/warehouse penuh, loyalty/member tier, payment gateway & QRIS integrasi,
thermal printer, offline-first, email/WhatsApp notifikasi, accounting double-entry,
payroll/HR, e-commerce. Struktur DB disiapkan agar tidak blocking (mis. `store_id`).

---

## BLOCKED / NEEDS DECISION

| # | Item | Dampak | Rekomendasi sementara |
|---|---|---|---|
| B1 | Definisi HPP/COGS untuk profit report (PRD §25.6) | Profit report bisa salah makna | Pakai `purchase_price` terakhir sebagai HPP sederhana; tandai asumsi di DECISIONS.md; finalisasi sebelum Milestone 8 |
| B2 | Pajak (tax) pada transaksi | Perhitungan total & laporan | MVP: tax opsional per-item rate, default 0 |
| B3 | Kebijakan negative stock | Validasi checkout | Default: **tidak diizinkan**; configurable per store |
| B4 | QRIS: integrasi vs pencatatan manual | Scope payment | MVP: pencatatan manual sebagai payment method |

---

## Dependency antar domain (ringkas)

```
auth ──┬── master data (category/unit/product/price/customer/supplier/payment_method)
       ├── shift ── sales ── inventory (movement) ── purchase (receipt)
       ├── cash ── reports
       └── approval/audit (cross-cutting, dipakai semua phase ≥3)
```

Detail: `docs/DEPENDENCY_MAP.md`.
