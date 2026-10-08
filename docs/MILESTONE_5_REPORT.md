# Milestone 5 — Inventory — Completion Report

Tanggal: 2026-10-08
Status: **SELESAI (kode)** — backend & mobile lengkap; test ditulis tapi belum dijalankan di env ini (tidak ada Java/DB di sandbox).

## Completed

- Dokumen inventaris: **stock opname**, **stock adjustment**, **stock transfer**, **stock receipt** — masing-masing dengan nomor dokumen otomatis (`OPN-YYYYMMDD-000001`, dst.) via `DocumentCounter` yang sudah ada (pessimistic lock, concurrent-safe).
- Setiap dokumen atomik: kunci baris balance (pessimistic) → update `InventoryBalance` → catat `StockMovement` (ledger) dalam satu transaksi.
- Opname: snapshot expected dari balance saat submit; selisih (counted − expected) otomatis jadi movement `STOCK_OPNAME`; baris tanpa selisih hanya tercatat di dokumen.
- Adjustment: alasan wajib (PRD §19); qty ≠ 0; stok hasil tidak boleh negatif (konsisten dengan kebijakan penjualan).
- Transfer: validasi lokasi asal ≠ tujuan; dicatat sebagai pasangan `TRANSFER_OUT` + `TRANSFER_IN` atomik; total balance produk tidak berubah (balance belum dipecah per lokasi).
- Receive: penerimaan barang menambah balance + movement `RECEIVE`.
- `stock_movements` diperkaya kolom `location` (PRD §17.1: setiap movement membawa warehouse/store); ledger **read-only** — tidak ada endpoint tulis/hapus movement.
- RBAC: endpoint `/api/v1/stock/...` dilindungi `stock.view`, `stock.opname`, `stock.adjustment`, `stock.transfer`, `stock.receive` (permission sudah di-seed di V2; tidak perlu seed ulang).
- Mobile: hub Inventaris (menu terfilter permission) + 4 layar: Stock Opname, Stock Adjustment, Stock Transfer, Riwayat Pergerakan Stok (read-only, paginated, filter produk).

## Files Changed

Backend:
- `inventory/entity/`: StockOpnameDoc, StockOpnameLine, StockAdjustment, StockTransfer, StockReceipt; `StockMovement` tambah kolom `location`
- `inventory/repository/`: StockOpnameDocRepository, StockAdjustmentRepository, StockTransferRepository, StockReceiptRepository; `StockMovementRepository` tambah query histori per produk + paging
- `inventory/dto/`: OpnameRequest/Response, OpnameLineRequest/Response, AdjustmentRequest/Response, TransferRequest/Response, ReceiptRequest/Response, StockMovementResponse, StockBalanceResponse
- `inventory/service/`: StockService (opname, adjustment, transfer, receive, balances, movements)
- `inventory/controller/`: StockController (`/api/v1/stock`)

Flyway: `V6__inventory.sql` (stock_opname_docs, stock_opname_lines, stock_adjustments, stock_transfers, stock_receipts, `stock_movements.location`).

Tests: `inventory/StockIntegrationTest.java` — 8 test (lihat di bawah).

Mobile (`mobile/src/`):
- `services/stockApi.ts`
- `modules/stock/StockScreen.tsx` (hub), `StockOpnameScreen.tsx`, `StockAdjustmentScreen.tsx`, `StockTransferScreen.tsx`, `StockHistoryScreen.tsx`
- `app/navigation.tsx` (menu "Inventaris" permission `stock.view`, 5 route baru)

## Database Changes

- V6: `stock_opname_docs`, `stock_opname_lines`, `stock_adjustments`, `stock_transfers`, `stock_receipts`; `ALTER TABLE stock_movements ADD COLUMN location VARCHAR(100)`.

## API Changes

| Method | Path | Permission |
|---|---|---|
| GET | `/api/v1/stock/balances` | stock.view |
| GET | `/api/v1/stock/movements?productId=&page=&size=` | stock.view |
| POST | `/api/v1/stock/opnames` | stock.opname |
| POST | `/api/v1/stock/adjustments` | stock.adjustment |
| POST | `/api/v1/stock/transfers` | stock.transfer |
| POST | `/api/v1/stock/receipts` | stock.receive |

## Business Rules Implemented

1. Opname: expected = snapshot balance saat submit; selisih otomatis jadi movement.
2. Adjustment wajib alasan; qty ≠ 0; tidak boleh membuat stok negatif.
3. Transfer: lokasi asal ≠ tujuan; pasangan OUT/IN atomik; total balance tidak berubah.
4. Receive: qty > 0; menambah balance.
5. Movement ledger append-only (read-only via API).
6. Nomor dokumen unik per tipe per hari (pessimistic lock di `document_counters`).

## Tests

`StockIntegrationTest` — 8 test ditulis:
- balances_listsStock
- opname_noDiff_recordsDocWithoutMovement (tanpa selisih → tanpa movement)
- opname_withDiff_adjustsBalanceAndPostsMovement
- adjustment_blankReason_rejected (400, bean validation)
- adjustment_negativeStock_rejected (422)
- transfer_atomic_pairMovementsBalanceUnchanged (OUT+IN, balance tetap)
- transfer_sameLocation_rejected (422)
- receive_increasesBalanceAndPostsMovement

Status: **belum dijalankan** (env). Jalankan di laptop:
```sh
cd backend && ./mvnw test -Dtest='StockIntegrationTest'
```
Mobile typecheck: ✅ `tsc --noEmit` lolos tanpa error.

## Known Issues

1. Backend belum di-compile/test di env ini (tidak ada JDK).
2. Balance masih per produk (belum per lokasi); transfer antar lokasi hanya tercatat di ledger, total tidak berubah.
3. Opname single-step (submit langsung apply); flow review/approval terpisah belum ada (PRD §18 penuh → milestone lanjut).
4. Approval untuk adjustment sensitif belum ada (bisa masuk Milestone 7 bersama approval variance shift).

## Next Recommended Milestone

**Milestone 6 — Purchase** (PO, goods receipt → reuse endpoint receive / movement `PURCHASE`) atau **Milestone 7 — Approval & Audit Log** (approval variance shift, adjustment sensitif, audit trail).
