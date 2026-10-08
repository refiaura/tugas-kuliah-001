# Milestone 4 — Cashier Shift — Completion Report

Tanggal: 2026-10-08
Status: **SELESAI (kode)** — backend & mobile lengkap; test ditulis tapi belum dijalankan di env ini.

## Completed

- Shift kasir: buka shift (opening cash), 1 shift OPEN per kasir (partial unique index + service check).
- Cash in/out dengan alasan, tercatat per shift.
- Tutup shift: expected cash dihitung backend = opening + cash sales + cash in − cash out; variance = actual − expected.
- Variance > Rp50.000 di-flag untuk review manager (approval flow di Milestone 7).
- Checkout sekarang wajib ada shift aktif (PRD §34 langkah 2); sale terhubung ke shift.
- Mobile: layar shift (buka, info aktif, ringkasan, cash in/out, tutup), POS cek shift sebelum bayar.

## Files Changed

Backend:
- `shift/entity/`: CashierShift, CashMovement
- `shift/repository/`: CashierShiftRepository, CashMovementRepository
- `shift/dto/`: OpenShiftRequest, CloseShiftRequest, ShiftResponse, CashMovementRequest, ShiftSummaryResponse
- `shift/service/`: ShiftService
- `shift/controller/`: ShiftController
- `sales/entity/Sale.java`: tambah relasi shift
- `sales/service/SaleService.java`: requireOpenShift() saat checkout
- `sales/repository/SaleRepository.java`: sumCashPaymentsByShift

Flyway: `V5__cashier_shift.sql` (cashier_shifts, cash_movements, sales.shift_id, permission shift/cash).

Mobile (`mobile/src/`):
- `services/shiftApi.ts`, `stores/shiftStore.ts`
- `modules/shift/ShiftScreen.tsx`, `CloseShiftScreen.tsx`
- `app/navigation.tsx` (menu Shift), POS cek shift

## Database Changes

- V5: `cashier_shifts`, `cash_movements`, `sales.shift_id` (FK nullable).

## API Changes

| Method | Path | Permission |
|---|---|---|
| GET | `/api/v1/shifts/current` | shift.open |
| POST | `/api/v1/shifts/open` | shift.open |
| POST | `/api/v1/shifts/close` | shift.close |
| POST | `/api/v1/shifts/cash-movement` | cash.in / cash.out |
| GET | `/api/v1/shifts/{id}/summary` | shift.open |

## Business Rules Implemented

1. Satu kasir hanya bisa punya 1 shift OPEN.
2. Checkout/resume wajib shift aktif.
3. Expected cash dihitung dari data backend (tidak dari input kasir).
4. Cash movement harus ada alasan.
5. Variance besar di-flag untuk approval.

## Tests

`ShiftIntegrationTest` — 4 test ditulis:
- openShift_success
- openShift_duplicate_rejected (409)
- closeShift_varianceCalculated (expected 550k, actual 540k, variance −10k)
- currentShift_returnsOpen

`SaleIntegrationTest` — tambah `checkout_withoutShift_rejected`.

Status: **belum dijalankan** (env). Jalankan di laptop:
```sh
cd backend && ./mvnw test -Dtest='ShiftIntegrationTest,SaleIntegrationTest'
```

## Known Issues

1. Backend belum di-compile/test di env ini.
2. Approval variance oleh manager belum ada (Milestone 7).
3. Multi-kasir di satu device belum ditangani (shift per user login).

## Next Recommended Milestone

**Milestone 5 — Inventory** (stock opname, adjustment, transfer — fondasi ledger sudah ada).
