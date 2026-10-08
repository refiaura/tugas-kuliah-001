# Milestone 8 Report — Dashboard / Reports / Notifications

**Tanggal:** 2026-10-08
**Commit:** `eff4c44` — `Milestone 8: Dashboard, Reports (6), Notifications (in-app)`
**PRD ref:** §24 Dashboard, §25 Reporting, §27 Notification

## Ringkasan

Milestone 8 selesai diimplementasikan dan di-push ke `main`. Backend menyediakan
dashboard KPI, 6 laporan, dan notifikasi in-app dengan event hooks. Mobile
menyediakan layar Dashboard, daftar Laporan + viewer, dan Notifikasi.

## Backend

### Migrasi

- **V10__notifications.sql** — tabel `notifications`
  (`id`, `user_id` nullable = broadcast, `type`, `title`, `message`,
  `entity_type`, `entity_id`, `is_read`, `created_at`) + index
  `(user_id, is_read, created_at)`.
- Permission baru `notification.view`, di-grant ke
  OWNER / ADMIN / SUPERVISOR / KASIR.

### Endpoint baru

| Method | Path | Permission |
|---|---|---|
| GET | `/api/v1/dashboard` | `report.sales` |
| GET | `/api/v1/reports/sales` | `report.sales` |
| GET | `/api/v1/reports/products` | `report.sales` |
| GET | `/api/v1/reports/inventory` | `report.stock` |
| GET | `/api/v1/reports/cash` | `report.cash` |
| GET | `/api/v1/reports/purchases` | `report.purchase` |
| GET | `/api/v1/reports/profit` | `report.profit` |
| GET | `/api/v1/notifications` | `notification.view` |
| GET | `/api/v1/notifications/unread-count` | `notification.view` |
| POST | `/api/v1/notifications/{id}/read` | `notification.view` |
| POST | `/api/v1/notifications/read-all` | `notification.view` |

### Isi

- **Dashboard:** KPI penjualan hari ini (omzet, transaksi, item, ATV, laba kotor),
  KPI inventaris (SKU aktif, low stock, out of stock, nilai stok), KPI kas
  (kas shift aktif, cash in/out hari ini, shift aktif, shift berselisih),
  alerts (low stock, shift > 12 jam belum tutup, approval pending,
  PO DRAFT > 7 hari).
- **Reports:** agregasi di database (JPQL), money BigDecimal, hanya transaksi
  COMPLETED. Filter `startDate`/`endDate` ISO; sales & purchases paged.
  Profit report: `netSales - cogs = grossProfit` + flag `cogsEstimated`
  (true bila ada produk tanpa harga pokok) — sesuai catatan PRD §25.6.
- **Notifications:** event hooks best-effort (tidak pernah melempar ke transaksi
  bisnis), dedup 24 jam untuk LOW_STOCK per produk:
  - checkout sale → LOW_STOCK / OUT_OF_STOCK (broadcast)
  - approval dibuat → PENDING_APPROVAL
  - shift close variance > Rp50.000 → SHIFT_VARIANCE
  - shift open → SHIFT_OPEN
  - PO DRAFT dibuat → PO_PENDING

### Keputusan desain

- Permission dashboard memakai `report.sales` yang sudah ada (tidak buat
  `dashboard.view`).
- `shiftNo` di cash report memakai label derivatif `SHF-<id>` (tidak ada kolom
  doc number di `cashier_shifts`).
- `paymentStatus` di purchase report default `BELUM_LUNAS` (modul payable belum
  ada) — terdokumentasi di query.
- Notifikasi event = broadcast (`user_id` null).

## Mobile

- `src/services/reportApi.ts` — API client + format Rupiah/tanggal + helper
  rentang tanggal.
- `src/modules/reports/DashboardScreen.tsx` — kartu KPI + daftar alert,
  pull-to-refresh.
- `src/modules/reports/ReportsScreen.tsx` — menu 6 laporan (filter permission).
- `src/modules/reports/ReportViewerScreen.tsx` — viewer generik (list + paged
  untuk sales/purchases, kartu ringkasan untuk profit).
- `src/modules/reports/NotificationsScreen.tsx` — daftar, tandai dibaca,
  tandai semua dibaca, pull-to-refresh.
- Navigasi: route `Dashboard`, `Reports`, `ReportViewer`, `Notifications`;
  menu Home bertambah (permission-based).
- `npx tsc --noEmit`: **lolos, 0 error.**

## Testing

- `ReportIntegrationTest` (7 test): dashboard KPI, sales report filter tanggal,
  product report agregat, profit report + flag `cogsEstimated`, notifikasi low
  stock setelah checkout, unread-count & mark-read.
- **Status:** ditulis, **belum di-run** (env ini tanpa JDK/Maven). Jalankan di
  laptop dev:
  ```sh
  cd backend
  ./mvnw test -Dtest='ReportIntegrationTest'
  ```
  (butuh PostgreSQL `pos_test`).

## Catatan untuk milestone berikutnya

- Milestone 9 (Hardening): jalankan **seluruh** backend test suite
  (M1–M8) di environment stabil, perbaiki yang gagal.
- Push notification / email / WhatsApp: future (PRD §27).
- Export laporan (PDF/Excel): belum ada di PRD inti; bisa ditambah bila
  dibutuhkan.
