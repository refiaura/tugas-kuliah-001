# Milestone 7 — Control — Completion Report

Tanggal: 2026-10-08
Status: **SELESAI (kode)** — backend & mobile lengkap; test ditulis tapi belum dijalankan di env ini (tidak ada Java/DB di sandbox).

## Completed

- **Approval workflow generik** (PRD §13, §14.1, §5): tabel `approvals` dengan `subject_type` (`SALE_VOID`, `SALE_RETURN`, `SHIFT_VARIANCE`), `subject_id`, `requested_by`, `reason` wajib, status `PENDING/APPROVED/REJECTED`, `decided_by/at`, `decision_note`. Partial unique index mencegah dua pengajuan PENDING untuk subjek yang sama. **Pengaju tidak boleh memutuskan pengajuannya sendiri** → 422 (konsisten dengan anti-self-approve PO di M6). Saat APPROVED, `ApprovalExecutor` untuk subject type berjalan dalam transaksi yang sama.
- **Void** (PRD §13): kasir request void pada sale COMPLETED (`sales.create`, reason wajib) → approval PENDING → supervisor approve (`approval.approve`) → sale jadi `VOIDED`: reversal stock movement tipe `VOID` (kebalikan persis dari movement `SALE` asli) + balance dikembalikan + kolom `voided_at/voided_by/void_reason` terisi + audit `SALE_VOID_EXECUTED`. Tidak ada endpoint void langsung — void tanpa approval **mustahil**. Baris sale tidak pernah dihapus (PRD §5.1).
- **Return/refund** (PRD §14): partial return per sale item, qty ≤ (terjual − sudah diretur), reason wajib, kondisi `SELLABLE`/`DAMAGED`. `SELLABLE` → balance normal bertambah; `DAMAGED` → kolom baru `damaged_qty` di `inventory_balances` (bukan balance normal). Refund tunai = Σ(qty × unit_price − diskon proporsional) diposting sebagai `cash_movements` tipe baru `REFUND` pada **shift aktif approver** (refund butuh shift aktif, seperti checkout — M4 rule). Semua return lewat approval inbox.
- **Audit log** (deferred M1/M2): tabel `audit_logs` append-only (actor, action, entity_type, entity_id, old/new JSONB, created_at); endpoint GET read-only `/api/v1/audit-logs`, **tanpa endpoint mutasi**. `AuditService` reusable; instrumentasi: `VOID_REQUESTED/EXECUTED`, `SALE_RETURN_REQUESTED/EXECUTED`, `PRICE_CHANGE` (hook `ProductService.updatePrice`, hanya saat harga benar-benar berubah), `USER_LOGIN/USER_LOGOUT` (AuthService), `USER_CREATED/UPDATED/DELETED` (UserService), `ROLE_CREATED/ROLE_PERMISSIONS_UPDATED/ROLE_DELETED` (RoleService), `SHIFT_VARIANCE_FLAGGED/REVIEWED`.
- **Shift variance approval** (deferred M4, PRD §11.3): close shift dengan |variance| > Rp50.000 (threshold M4 dipertahankan — keputusan desain) otomatis membuat approval request `SHIFT_VARIANCE` (PENDING) untuk review supervisor via `ShiftVarianceEvent` + `@TransactionalEventListener(BEFORE_COMMIT)` (agar konsisten dengan transaksi close dan tetap testable di test `@Transactional`). Shift tetap tertutup, tidak diblokir.
- RBAC: request void/return memakai `sales.create` (KASIR punya; `sales.void/refund/return` di-seed V2 hanya untuk OWNER/SUPERVISOR — lihat Keputusan Desain #2). Inbox & audit memakai `approval.view`; decide memakai `approval.approve`/`approval.reject`. Permission `approval.*` sudah di-seed di V2, tidak perlu seed ulang.
- Mobile: hub Kontrol (menu terfilter permission) + 5 layar: Riwayat Transaksi (filter status COMPLETED/VOIDED), Detail Transaksi (tombol minta void), Retur Penjualan (pilih item, qty, SELLABLE/DAMAGED, reason), Approval Inbox (pending + approve/reject), Audit Log (filter entity). `SaleItemResponse` backend & mobile ditambah field `id` (dibutuhkan layar retur).

## Files Changed

Backend:
- `control/entity/`: Approval (+SubjectType/Status enum), AuditLog, SaleReturn (+Status), SaleReturnLine (+Condition)
- `control/repository/`: ApprovalRepository, AuditLogRepository, SaleReturnRepository, SaleReturnLineRepository
- `control/dto/`: ApprovalResponse, ApprovalDecisionRequest, RequestVoidRequest, RequestReturnRequest, ReturnLineRequest, SaleReturnResponse, ReturnLineResponse, AuditLogResponse
- `control/service/`: AuditService, ApprovalService, ApprovalExecutor (interface), SaleVoidExecutor, SaleReturnExecutor, ShiftVarianceExecutor, ShiftVarianceListener, ControlService
- `control/event/`: ShiftVarianceEvent
- `control/controller/`: ApprovalController (`/api/v1/approvals`), ControlController (`/api/v1/sales/.../void`, `/returns`), AuditController (`/api/v1/audit-logs`, GET only)
- Modifikasi: `Sale.Status` += `VOIDED`; `Sale` += voidedAt/voidedBy/voidReason; `SaleItem` += returnedQty; `SaleItemResponse` += id; `InventoryBalance` += damagedQty; `CashMovement.Type` += `REFUND`; `StockMovementRepository` += findByMovementTypeAndReferenceTypeAndReferenceId; `ShiftService`: summary hitung REFUND sebagai outflow, close() publish ShiftVarianceEvent saat |variance| > 50000; audit hooks di `ProductService.updatePrice`, `AuthService.login/logout`, `UserService.create/update/delete`, `RoleService.create/assignPermissions/delete`

Flyway: `V9__control.sql` (approvals + partial unique index, audit_logs, sale_returns + lines, `damaged_qty`, `returned_qty`, kolom void di sales, `chk_movement_type` diperluas dengan REFUND).

Tests: `control/ControlIntegrationTest.java` — 8 test (lihat di bawah).

Mobile (`mobile/src/`):
- `services/controlApi.ts` (approvals, void, return, audit)
- `services/saleApi.ts`: `SaleItemResponse.id` ditambahkan
- `modules/control/`: ControlScreen (hub), TransactionHistoryScreen, TransactionDetailScreen, ReturnRequestScreen, ApprovalInboxScreen, AuditLogScreen
- `app/navigation.tsx` (menu "Kontrol" permission `sales.view`, 6 route baru)

## Database Changes

- V9: `approvals`, `audit_logs`, `sale_returns`, `sale_return_lines`; kolom baru `inventory_balances.damaged_qty`, `sale_items.returned_qty`, `sales.voided_at/voided_by/void_reason`; CHECK `cash_movements.type` menjadi `('IN','OUT','REFUND')`. Status sale tetap VARCHAR tanpa CHECK — `VOIDED` aman.

## API Changes

| Method | Path | Permission |
|---|---|---|
| GET | `/api/v1/approvals?status=&page=&size=` | approval.view |
| GET | `/api/v1/approvals/{id}` | approval.view |
| POST | `/api/v1/approvals/{id}/approve` | approval.approve |
| POST | `/api/v1/approvals/{id}/reject` | approval.reject |
| POST | `/api/v1/sales/{id}/void` | sales.create |
| POST | `/api/v1/sales/{id}/returns` | sales.create |
| GET | `/api/v1/sales/returns?page=&size=` | sales.view |
| GET | `/api/v1/sales/{id}/returns` | sales.view |
| GET | `/api/v1/sales/returns/{returnId}` | sales.view |
| GET | `/api/v1/audit-logs?entityType=&page=&size=` | approval.view |

## Business Rules Implemented

1. Void & return tidak pernah bisa dieksekusi tanpa approval — tidak ada endpoint eksekusi langsung.
2. Anti-self-approve: `requested_by == decided_by` → 422 (void, return, PO M6 — konsisten).
3. Satu pengajuan PENDING per subjek (partial unique index + cek service → 409 jika duplikat).
4. Void hanya untuk sale COMPLETED; reversal stok atomik (pessimistic lock) dengan movement `VOID`.
5. Return: qty ≤ (sold − returned) per item; `DAMAGED` tidak menambah balance normal; refund tunai butuh shift aktif approver; `sale_items.returned_qty` dilacak untuk partial return berulang.
6. `REFUND` dihitung sebagai outflow pada expected cash shift (konsisten dengan contoh PRD §11.3).
7. Audit append-only: tidak ada PUT/DELETE pada audit log di level API maupun service.

## Keputusan Desain

1. **Threshold variance**: Rp50.000 dipertahankan dari M4 (konstanta `VARIANCE_THRESHOLD` di ShiftService). Alasan: konsistensi dengan perilaku flag M4; nilai ini mudah diubah jadi konfigurasi di M9.
2. **Permission request vs `sales.void`**: V2 seed memberi `sales.void/refund/return` hanya ke OWNER/SUPERVISOR, sedangkan PRD §13 menuntut kasir sebagai pengaju. Request endpoint memakai `sales.create` (kasir punya); keputusan tetap di tangan `approval.approve`. Alternatif (memberi `sales.void` ke KASIR) ditolak karena mengaburkan makna permission.
3. **Event vs dependensi langsung**: `ShiftService` publish `ShiftVarianceEvent`; listener di package control yang membuat approval. Menghindari circular dependency shift↔control (Spring Boot melarang circular reference by default).
4. **Refund amount**: Σ(qty_retur × unit_price − diskon proporsional per item). Didokumentasikan; jika kebijakan refund berbeda (mis. tanpa diskon), ubah di `ControlService`.
5. **Semua return butuh approval** (tidak ada threshold auto-approve) — sesuai permintaan task; threshold bisa ditambah di M9.

## Tests

`ControlIntegrationTest` — 8 test ditulis:
- `void_requiresApproval_saleStaysCompletedUntilApproved` (tanpa approve: status tetap COMPLETED, stok tak berubah)
- `selfApprove_rejected` (owner2 approve request sendiri → 422; admin approve → VOIDED)
- `voidExecution_reversesStockAndAudits` (stok 7→10, movement VOID +3, audit `SALE_VOID_EXECUTED`)
- `returnSellable_addsToNormalBalance` (balance 7→8, movement `SALE_RETURN`, audit `SALE_RETURN_EXECUTED`)
- `returnDamaged_goesToDamagedBucket` (balance tetap 7, damaged_qty 0→2)
- `returnMoreThanSold_rejected` (retur 5 dari 2 → 422)
- `priceChange_audited` (audit `PRICE_CHANGE` tercatat)
- `shiftVariance_createsApprovalRequest` (close dengan variance 100rb → approval SHIFT_VARIANCE PENDING)

Status: **belum dijalankan** (env). Jalankan di laptop:
```sh
cd backend && ./mvnw test -Dtest='ControlIntegrationTest'
```
Mobile typecheck: ✅ `tsc --noEmit` lolos tanpa error.

## Known Issues

1. Backend belum di-compile/test di env ini (tidak ada JDK).
2. `SaleResponse` belum mengekspos `voidedBy/voidReason` — mobile hanya menampilkan status VOIDED (bisa ditambah di M8/M9).
3. Tidak ada threshold auto-approve untuk return kecil; semua return masuk inbox.
4. Siklus hutang supplier (deferred M6) dan laporan (M8) belum dikerjakan.

## Next Recommended Milestone

**Milestone 8 — Dashboard / Reports / Notification** (laporan sales/stok/kas/purchase/profit, KPI + alert low stock/shift terbuka/approval pending) — backlog `docs/BACKLOG.md`.
