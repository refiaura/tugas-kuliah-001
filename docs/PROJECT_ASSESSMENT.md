# PROJECT ASSESSMENT — Aplikasi Kasir / POS

**Repo:** `refiaura/tugas-kuliah-001`
**PRD:** `PRD_Aplikasi_Kasir_POS.md` v1.0 (2026-10-08) — single source of truth
**Tanggal assessment:** 2026-10-08
**Assessor role:** Senior Software Engineer / Solution Architect

---

## PROJECT SUMMARY

Aplikasi Point of Sale (POS) + operasional toko berdasarkan PRD v1.0: penjualan & pembayaran,
shift kasir & rekonsiliasi kas, master data produk, inventory berbasis stock movement/ledger,
pembelian & supplier, retur/void/refund dengan approval, audit trail, laporan, dan notifikasi.

Target stack (sesuai PRD §1):

| Layer    | Teknologi |
|----------|-----------|
| Frontend | React Native 0.87.1 (TypeScript) — sudah ada di repo |
| Backend  | Spring Boot (REST API) — **belum ada** |
| Database | PostgreSQL — **belum ada** |
| Migration| Flyway — **belum ada** |

Prioritas: **data integrity > security > business correctness > maintainability > performance > UI polish.**

---

## CURRENT ARCHITECTURE

```
tugas-kuliah-001/
├── mobile/     # React Native 0.87.1 + React 19.2.3 + TypeScript (template bawaan)
├── backend/    # (kosong — akan diisi Spring Boot)
└── docs/       # dokumen desain & assessment
```

- **Tidak ada backend, database, migration, auth, atau domain code sama sekali.**
- Mobile app adalah hasil `react-native init` murni: `App.tsx` contoh, folder `android/` & `ios/`
  bawaan, Jest + ESLint terkonfigurasi. Tidak ada navigation, state management, atau API client.
- Tidak ada Java/Gradle/Maven di environment kerja saat ini — toolchain backend perlu disiapkan
  pada Phase 0.
- Tidak ada technical debt: tidak ada kode bisnis yang perlu di-rewrite. Ini **greenfield** dengan
  satu fondasi frontend yang valid.

---

## EXISTING MODULES

| Modul | Status |
|---|---|
| Mobile scaffold (RN 0.87.1, TS, Jest, ESLint, Metro) | ✅ Ada — template bawaan |
| Auth / RBAC | ❌ Tidak ada |
| Master data (product, category, unit, customer, supplier) | ❌ Tidak ada |
| Sales / POS / Payment | ❌ Tidak ada |
| Cashier shift | ❌ Tidak ada |
| Inventory / stock movement | ❌ Tidak ada |
| Purchase | ❌ Tidak ada |
| Return / void / refund / approval / audit | ❌ Tidak ada |
| Dashboard / reports / notification | ❌ Tidak ada |
| Backend / database / migration | ❌ Tidak ada |

---

## REUSABLE COMPONENTS

Hampir tidak ada kode bisnis yang bisa dipakai ulang. Yang reusable dari template:

- Konfigurasi TypeScript (`tsconfig.json`), ESLint, Jest, Metro, Babel.
- Struktur folder `android/` & `ios/` bawaan React Native (tidak perlu generate ulang).
- `.gitignore` bawaan (sudah mencakup `node_modules`, build artifacts).

Keputusan: **tidak ada rewrite** — template dipakai apa adanya sebagai fondasi `mobile/`.

---

## GAPS AGAINST PRD

Semua domain PRD berstatus gap (detail di `GAP_ANALYSIS.md`). Ringkasan per phase:

| Phase | Domain | Gap |
|---|---|---|
| 0 | Project setup, DB, migration, common response, exception handling, logging | Full gap — backend belum ada |
| 1 | Auth, User, Role, Permission (RBAC) | Full gap |
| 2 | Category, Unit, Product, Variant, Barcode, Price (+history), Customer, Supplier, Payment Method | Full gap |
| 3 | POS: cart, checkout, payment (split), receipt, hold/resume, transaction history | Full gap |
| 4 | Shift: open/close, opening cash, cash in/out, reconciliation, variance | Full gap |
| 5 | Inventory: stock movement ledger, balance cache, low stock, adjustment, opname | Full gap |
| 6 | Purchase: PO, approval, goods receipt (partial), purchase return, payable (struktur) | Full gap |
| 7 | Void, return/refund, approval workflow, audit log | Full gap |
| 8 | Dashboard, reports (sales/inventory/cash/purchase/profit), notification | Full gap |
| 9 | Hardening, testing, optimization | Full gap |

Tidak ada konflik dengan kode existing karena tidak ada kode existing — tidak ada analisis
dampak rewrite yang diperlukan.

---

## TECHNICAL RISKS

| # | Risiko | Dampak | Mitigasi |
|---|---|---|---|
| R1 | Scope PRD sangat besar untuk tugas kuliah (9 phase, ~50 entitas) | Tidak selesai / kualitas rendah | Disiplin MVP (PRD §40): Must Have dulu; Should/Could Have eksplisit ditunda |
| R2 | Concurrency checkout (stok terakhir dibeli 2 kasir bersamaan) | Oversell / stok negatif | DB transaction + row lock / atomic update; test concurrency wajib (PRD §9, §35) |
| R3 | Perhitungan uang dengan float | Selisih rupiah | `BigDecimal` + `NUMERIC`; rounding rule tunggal (PRD §10) |
| R4 | Penomoran dokumen (INV/PO/RET) tidak aman-concurrent | Nomor duplikat | Counter per-hari dengan row lock / sequence (PRD §36) |
| R5 | Business rule bocor ke frontend (grandTotal, expectedCash dari client) | Manipulasi | Backend hitung ulang semua nilai authoritative (PRD §23) |
| R6 | Audit log bisa diubah/dihapus | Kehilangan keterlacakan | Tabel append-only; tanpa endpoint update/delete (PRD §14, §26) |
| R7 | Toolchain Java belum tersedia di environment | Backend tidak bisa di-build/test lokal | Setup JDK 21 + Maven di Phase 0 |
| R8 | Definisi HPP/laba belum disepakati (PRD §25.6 mencatat ini) | Profit report salah makna | Tandai BLOCKED; sepakati definisi sebelum Milestone 8 |
| R9 | Integrasi QRIS/payment gateway & thermal printer | Scope creep | Masuk Could Have; MVP pakai pencatatan manual metode pembayaran |

---

## RECOMMENDED IMPLEMENTATION ORDER

Mengikuti PRD §2 dan §49 (tidak melompat phase bila dependency belum stabil):

```
Phase 0  Project setup & Architecture  ← posisi saat ini (dokumen ini)
Phase 1  Auth + RBAC
Phase 2  Master Data
Phase 3  Sales / POS / Payment
Phase 4  Cashier Shift
Phase 5  Inventory
Phase 6  Purchase
Phase 7  Return / Void / Refund / Approval / Audit
Phase 8  Dashboard / Reports / Notification
Phase 9  Hardening / Testing / Optimization
```

Setiap phase mengikuti workflow: design → migration → backend → test → frontend →
integration test → acceptance → document. Definition of Done per PRD §20/§47.
