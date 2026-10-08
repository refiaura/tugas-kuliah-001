# Milestone 6 — Purchase — Completion Report

Tanggal: 2026-10-08
Status: **SELESAI (kode)** — backend & mobile lengkap; test ditulis tapi belum dijalankan di env ini (tidak ada Java/DB di sandbox).

## Completed

- **Purchase order lifecycle** (PRD §21.1): `DRAFT → SUBMITTED → APPROVED → ORDERED → PARTIALLY_RECEIVED → RECEIVED`, plus `CANCELLED` (hanya dari DRAFT/SUBMITTED). Nomor dokumen otomatis `PO-YYYYMMDD-000001` via `DocumentCounter` (prefix baru `PO`, counter per hari).
- **Aturan emas**: PO tidak pernah menyentuh stok. Stok hanya berubah lewat goods receipt (`PURCHASE`, stock in) dan purchase return (`PURCHASE_RETURN`, stock out) — atomik dengan pessimistic lock balance seperti M5.
- **Goods receipt** (PRD §21.2): parsial didukung — satu PO bisa diterima beberapa kali; per baris PO total terima tidak boleh melebihi qty order; setelah receipt PO menjadi `PARTIALLY_RECEIVED` atau `RECEIVED`.
- **Purchase return** (PRD §21.3): retur ke supplier → stock out + movement `PURCHASE_RETURN` + kolom `supplier_credit` sederhana (qty × harga beli per baris); qty retur tidak boleh melebihi (diterima − sudah diretur) per baris; stok hasil tidak boleh negatif. Siklus payable penuh ditunda (sesuai scope).
- **Approval**: hanya `purchase.approve`; pembuat PO tidak boleh approve PO-nya sendiri (422 — foreshadowing approval formal Milestone 7).
- RBAC: endpoint `/api/v1/purchases/...` dilindungi `purchase.view`, `purchase.create`, `purchase.approve`, `purchase.receive`, `purchase.return` (permission sudah di-seed di V2; tidak perlu seed ulang). Supplier memakai master data M2 (supplier harus aktif).
- Mobile: hub Pembelian (menu terfilter permission) + 5 layar: Daftar PO (filter status), Buat PO (pilih supplier + tambah baris produk dengan qty/harga), Detail PO (tombol submit/cancel/approve/kirim sesuai status & permission, shortcut terima/retur), Terima Barang (input actual qty per baris, parsial OK), Retur Pembelian (qty + alasan wajib).

## Files Changed

Backend:
- `purchase/entity/`: PurchaseOrder (+Status enum), PurchaseOrderLine, GoodsReceipt, GoodsReceiptLine, PurchaseReturn, PurchaseReturnLine
- `purchase/repository/`: PurchaseOrderRepository, PurchaseOrderLineRepository, GoodsReceiptRepository, GoodsReceiptLineRepository (query `sumReceivedByPoLineId`), PurchaseReturnRepository, PurchaseReturnLineRepository (query `sumReturnedByPoLineId`)
- `purchase/dto/`: PurchaseOrderRequest/Response, PoLineRequest/Response, GoodsReceiptRequest/Response, GrLineRequest/Response, PurchaseReturnRequest/Response, PrLineRequest/Response
- `purchase/service/`: PurchaseService (create/submit/approve/markOrdered/cancel/receive/createReturn + reads)
- `purchase/controller/`: PurchaseController (`/api/v1/purchases`)

Flyway: `V7__purchase.sql` (purchase_orders, purchase_order_lines, goods_receipts, goods_receipt_lines, purchase_returns, purchase_return_lines).

Tests: `purchase/PurchaseIntegrationTest.java` — 8 test (lihat di bawah).

Mobile (`mobile/src/`):
- `services/purchaseApi.ts` (+ `listSuppliers`)
- `modules/purchase/PurchaseScreen.tsx` (hub), `PurchaseOrderListScreen.tsx`, `PurchaseOrderFormScreen.tsx`, `PurchaseOrderDetailScreen.tsx`, `GoodsReceiptScreen.tsx`, `PurchaseReturnScreen.tsx`
- `app/navigation.tsx` (menu "Pembelian" permission `purchase.view`, 6 route baru)

## Database Changes

- V7: `purchase_orders`, `purchase_order_lines`, `goods_receipts`, `goods_receipt_lines`, `purchase_returns`, `purchase_return_lines`. Status PO di-CHECK constraint; qty > 0 di-CHECK.

## API Changes

| Method | Path | Permission |
|---|---|---|
| GET | `/api/v1/purchases/orders?status=&page=&size=` | purchase.view |
| POST | `/api/v1/purchases/orders` | purchase.create |
| GET | `/api/v1/purchases/orders/{id}` | purchase.view |
| POST | `/api/v1/purchases/orders/{id}/submit` | purchase.create |
| POST | `/api/v1/purchases/orders/{id}/approve` | purchase.approve |
| POST | `/api/v1/purchases/orders/{id}/mark-ordered` | purchase.create |
| POST | `/api/v1/purchases/orders/{id}/cancel` | purchase.create |
| GET | `/api/v1/purchases/receipts?poId=&page=&size=` | purchase.view |
| POST | `/api/v1/purchases/receipts` | purchase.receive |
| GET | `/api/v1/purchases/returns?poId=&page=&size=` | purchase.view |
| POST | `/api/v1/purchases/returns` | purchase.return |

## Business Rules Implemented

1. PO tidak menambah stok — hanya goods receipt (movement `PURCHASE`) dan purchase return (movement `PURCHASE_RETURN`).
2. Lifecycle ketat: submit hanya dari DRAFT, approve hanya dari SUBMITTED, ordered hanya dari APPROVED, cancel hanya DRAFT/SUBMITTED.
3. Self-approval ditolak: `created_by == approved_by` → 422.
4. Partial receipt: qty terima per baris tidak boleh melebihi (order − sudah diterima); status PO maju ke PARTIALLY_RECEIVED/RECEIVED otomatis.
5. Retur: qty tidak boleh melebihi (diterima − sudah diretur); alasan wajib; stok hasil tidak boleh negatif; kredit supplier = Σ(qty × unit_price).
6. Nomor dokumen unik per tipe per hari (`PO-`/`GR-`/`PR-` via `document_counters`).

## Tests

`PurchaseIntegrationTest` — 8 test ditulis:
- poLifecycle_noDiff… → `poLifecycle_noStockChangeUntilReceipt` (DRAFT→ORDERED tanpa stok/movement)
- `partialReceipt_addsStockAndAdvancesStatus` (40 → PARTIALLY_RECEIVED, +60 → RECEIVED, 2 movement PURCHASE)
- `receiveMoreThanOrdered_rejected` (60 + 50 > 100 → 422)
- `selfApprove_rejected` (422, tetap SUBMITTED)
- `cancelApproved_rejected` (422, tetap ORDERED)
- `cancelDraft_allowed`
- `purchaseReturn_reducesStockAndCreditsSupplier` (stok 100→80, kredit 180000, movement PURCHASE_RETURN)
- `returnMoreThanReceived_rejected` (150 > 100 → 422)

Status: **belum dijalankan** (env). Jalankan di laptop:
```sh
cd backend && ./mvnw test -Dtest='PurchaseIntegrationTest'
```
Mobile typecheck: ✅ `tsc --noEmit` lolos tanpa error.

## Known Issues

1. Backend belum di-compile/test di env ini (tidak ada JDK).
2. Siklus hutang (payable) supplier belum ada — hanya kolom `supplier_credit` di return; masuk Milestone 7/8.
3. Tidak ada edit baris PO setelah dibuat — pola saat ini: cancel lalu buat baru.
4. Approval formal (multi-level, audit trail) ditunda ke Milestone 7; aturan anti-self-approve sudah jadi fondasi.

## Next Recommended Milestone

**Milestone 7 — Control** (void flow request→approve, retur penjualan SELLABLE/DAMAGED, audit log PRICE_CHANGE & login/logout, approval variance shift) — backlog `docs/BACKLOG.md`.
