# Milestone 3 — POS / Sales — Completion Report

Tanggal: 2026-10-08
Status: **SELESAI (kode)** — backend & mobile lengkap; test backend ditulis tapi belum dijalankan di env ini.

## Completed

- Checkout atomik satu transaksi (PRD §34): validasi produk aktif → kunci stok (pessimistic lock) → hitung total di backend → validasi pembayaran → nomor invoice concurrent-safe → simpan sale+items+payments → catat stock movement → update balance.
- Harga item di-snapshot ke `sale_items` (tidak berubah saat harga master berubah).
- Split payment; `SUM(payment) >= grand_total`; kembalian otomatis.
- Idempotency key: double submit mengembalikan transaksi yang sama (stok hanya terpotong sekali).
- Hold/resume: HOLD tidak memotong stok; resume validasi ulang stok lalu complete.
- Stok tidak boleh negatif (ditolak dengan pesan jelas).
- Invoice: `INV-YYYYMMDD-000001`, counter per hari dengan row lock.
- Mobile: layar POS (search produk, cart, qty, diskon), pembayaran split, struk.

## Files Changed

Backend:
- `sales/entity/`: Sale, SaleItem, SalePayment
- `sales/repository/`: SaleRepository
- `sales/dto/`: CheckoutRequest/Item/Payment, HoldRequest, SaleResponse/Item/Payment
- `sales/service/`: SaleService (checkout, hold, resumeAndCheckout)
- `sales/controller/`: SaleController
- `inventory/entity/`: StockMovement, InventoryBalance, DocumentCounter
- `inventory/repository/`: 3 repository (dengan pessimistic lock)

Flyway: `V4__pos_sales.sql` (+ permission sales.view/create/void).

Mobile (`mobile/src/`):
- `services/saleApi.ts`, `stores/cartStore.ts`
- `modules/pos/PosScreen.tsx`, `PaymentScreen.tsx`, `ReceiptScreen.tsx`
- `app/navigation.tsx` (route POS)

## Database Changes

- V4: `document_counters`, `sales`, `sale_items`, `sale_payments`, `stock_movements`, `inventory_balances`.

## API Changes

| Method | Path | Permission |
|---|---|---|
| POST | `/api/v1/sales/checkout` | sales.create |
| POST | `/api/v1/sales/hold` | sales.create |
| POST | `/api/v1/sales/{id}/resume` | sales.create |
| GET | `/api/v1/sales?status=` | sales.view |
| GET | `/api/v1/sales/{id}` | sales.view |

## Business Rules Implemented

1. Produk nonaktif tidak bisa dijual.
2. Qty > 0 (validasi).
3. Stok dicek dengan lock; tidak cukup → tolak, tidak ada stok negatif.
4. Total dihitung backend (bukan dari client).
5. Pembayaran harus >= grand total.
6. Diskon tidak boleh melebihi harga/subtotal.
7. Stock movement selalu tercatat untuk setiap penjualan.

## Tests

`SaleIntegrationTest` — 6 test ditulis:
- checkout_valid_success (total, bayar, kembalian, stok berkurang)
- checkout_emptyCart_rejected
- checkout_insufficientStock_rejected (stok tidak berubah)
- checkout_doubleSubmit_idempotent (invoice sama, stok sekali)
- hold_doesNotTouchStock + resume
- checkout_inactiveProduct_rejected

Status: **belum dijalankan** — environment VM ke-replace (Maven repo hilang, proxy bermasalah). Jalankan di laptop: `cd backend && ./mvnw test -Dtest=SaleIntegrationTest`.

Mobile: `npx tsc --noEmit` lolos (0 error).

## Known Issues

1. Backend belum di-compile/test di env ini — perlu verifikasi di laptop user.
2. Concurrent checkout stress test belum dijalankan.
3. Validasi shift aktif belum ada (Milestone 4).
4. Audit log formal belum ada (Milestone 7).
5. Struk cetak fisik belum — ReceiptScreen hanya tampil.

## Technical Debt

- `InventoryBalance` pakai `@Version` optimistic + pessimistic lock di query — konsisten, tapi perlu load test.
- Payment method di mobile hardcode mapping ID (1-5); idealnya GET dari API.

## Next Recommended Milestone

**Milestone 4 — Cashier Shift** (buka/tutup shift, kas awal/akhir, validasi shift saat checkout).
