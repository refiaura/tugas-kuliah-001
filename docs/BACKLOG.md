# MVP IMPLEMENTATION BACKLOG

Checklist per milestone. Definition of Done: PRD §20/§47
(migration → entity → repository → service → DTO → validation → controller →
auth → business rule → audit → test → frontend → states → integrasi → docs).

## MILESTONE 0 — Assessment & Setup ✅ (dokumen ini)

- [x] `PROJECT_ASSESSMENT.md`, `ARCHITECTURE.md`, `GAP_ANALYSIS.md`
- [x] `DEPENDENCY_MAP.md`, `BACKLOG.md`, `DECISIONS.md`
- [x] Setup `backend/` (Maven, Spring Boot 4.1, Java 21) — Initializr kini 4.x, lihat D-002
- [x] Flyway baseline + `common`: ApiResponse, GlobalExceptionHandler, logging, health check
- [ ] Restruktur monorepo `mobile/` (done) + root README

## MILESTONE 1 — Auth & RBAC ✅ (2026-10-08, lihat `MILESTONE_1_REPORT.md`)

- [x] Migration: users, roles, permissions, role_permissions (+seed 7 role & 39 permission)
- [x] BCrypt, JWT access+refresh, login/logout/refresh/me
- [x] `@PreAuthorize` permission checks; user aktif/nonaktif
- [x] Test: 19/19 lolos (login valid/invalid, refresh rotation+reuse, logout, RBAC 403, inactive user)
- [x] Mobile: login screen, authStore, token refresh interceptor, menu by permission
- [ ] Audit log login/logout & perubahan user/role → Milestone 7

## MILESTONE 2 — Master Data ✅ (2026-10-08, lihat `MILESTONE_2_REPORT.md`)

- [x] Category, Unit, Product (+SKU/barcode unique, is_active), Variant
- [x] `product_prices` history; Customer (+GENERAL seed), Supplier
- [x] `payment_methods` seed (CASH, QRIS, DEBIT, CREDIT_CARD, TRANSFER)
- [x] CRUD + pagination/search/filter + validation; price change tercatat di product_prices
- [x] Test: 5/5 lolos (SKU duplikat ditolak, histori harga, RBAC kasir 403, search)
- [x] Mobile: daftar produk + search, form produk (tsc lolos)
- [ ] Audit log PRICE_CHANGE formal → Milestone 7

## MILESTONE 3 — POS / Sales

- [ ] `sales`, `sale_items` (snapshot harga), `sale_payments`, `document_counters`
- [ ] Checkout `@Transactional` 10 langkah (PRD §34); split payment; kembalian
- [ ] Hold/resume (status HELD, tanpa potong stok); invoice unik concurrent-safe
- [ ] Test: valid checkout, empty cart, insufficient stock, **concurrent checkout**,
      double submit (idempotency), partial payment
- [ ] Mobile: POS screen (cart, barcode search, keyboard shortcut), payment, receipt

## MILESTONE 4 — Cashier Shift

- [ ] `cashier_shifts` (1 aktif/kasir), `cash_movements` (in/out + reason)
- [ ] Close shift: expected cash dihitung backend, variance, threshold approval
- [ ] Checkout validasi shift aktif
- [ ] Test: duplicate active shift, variance calc, cash in/out
- [ ] Mobile: open shift, current shift, cash movement, close shift + reconcile

## MILESTONE 5 — Inventory

- [ ] `stock_movements` (10 tipe, reference wajib), `stock_balances` cache atomik
- [ ] Low/out of stock; `allow_negative_stock` config (default false)
- [ ] `stock_adjustments` beralasan; opname (snapshot→count→diff→approval→adjustment)
- [ ] Test: purchase in, sale out, return in, adjustment, opname diff, negative prevention
- [ ] Mobile: stock list, movement history, adjustment, opname

## MILESTONE 6 — Purchase

- [ ] `purchases` PO lifecycle (DRAFT→RECEIVED); approval; **PO tidak tambah stok**
- [ ] `goods_receipts` parsial → movement PURCHASE; purchase return (Should Have)
- [ ] Test: PO approve flow, partial receipt, return stock out
- [ ] Mobile: PO list/form, goods receipt

## MILESTONE 7 — Control

- [ ] Void (request→reason→approval→VOIDED); return/refund (SELLABLE/DAMAGED)
- [ ] `approvals` workflow; `audit_logs` append-only (tanpa endpoint mutasi)
- [ ] Test: void butuh approval, kasir tidak bisa approve sendiri, audit tercatat
- [ ] Mobile: transaction history/detail, void, return/refund, approval inbox, audit log

## MILESTONE 8 — Dashboard / Reports / Notification

- [ ] Report: sales, product sales, inventory, cash, purchase, profit (HPP definisi B1)
- [ ] Dashboard KPI + alert (low stock, shift terbuka, approval pending)
- [ ] Agregasi di DB; pagination; test konsistensi vs transaksi finalized
- [ ] Mobile: dashboard, halaman reports

## MILESTONE 9 — Hardening

- [ ] Index review, N+1 check, slow query; security checklist (PRD §23)
- [ ] Full test suite hijau; migration clean; e2e business flow (PRD §30)

---

## Test plan (business-critical) — ringkas

`checkout concurrent` · `insufficient stock` · `split payment` · `shift variance` ·
`void approval` · `return stock correction` · `purchase receipt` · `opname diff` ·
`audit immutability` · `permission denial` · `document numbering concurrent`.

## Risks (ringkas)

R1 scope creep → disiplin MVP · R2 concurrency → lock+test · R3 float money → BigDecimal ·
R4 numbering → counter+lock · R8 definisi HPP → sepakati sebelum M8. Detail: PROJECT_ASSESSMENT.md.
