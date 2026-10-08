# DECISIONS & ASSUMPTIONS

Catat setiap keputusan yang menyimpang dari PRD atau membutuhkan asumsi.
Format: WHAT / WHY / IMPACT.

---

## D-001 — Monorepo `mobile/` + `backend/` + `docs/`
- **What:** Template React Native dipindah dari repo root ke `mobile/`.
- **Why:** Satu repo tugas; backend Spring Boot butuh lokasi sendiri tanpa rewrite.
- **Impact:** Path berubah; CI/dokumen mengacu ke `mobile/`.

## D-002 — Backend: Spring Boot 3 + Java 21 + Maven + Flyway
- **What:** Stack backend sesuai PRD §1; Maven sebagai build tool.
- **Why:** Maven paling umum di kurikulum & tutorial; Flyway wajib PRD.
- **Impact:** Perlu JDK 21 di semua environment dev.

## D-003 — Auth: JWT (access 15 mnt + refresh 7 hari, rotation)
- **What:** Stateless JWT, bukan session server-side.
- **Why:** Cocok untuk mobile client; PRD §6 mengizinkan JWT/session.
- **Impact:** Refresh token disimpan aman di client (secure storage).

## D-004 — Uang: `BigDecimal` + `NUMERIC(19,2)`
- **What:** Tidak ada float/double untuk uang di semua layer.
- **Why:** PRD §10; presisi rupiah.
- **Impact:** Rounding rule tunggal didokumentasikan di service.

## D-005 — Stok: ledger `stock_movements` + cache `stock_balances`
- **What:** Cache boleh ada, tapi movement wajib & konsisten dalam 1 transaksi.
- **Why:** PRD §5.3; performa + auditability.
- **Impact:** Semua perubahan stok lewat service inventory terpusat.

## D-006 — Nomor dokumen: `document_counters` per-hari + row lock
- **What:** Format `INV-YYYYMMDD-000001`; counter di DB, bukan di aplikasi.
- **Why:** Aman terhadap concurrent request (PRD §36).
- **Impact:** Satu tabel tambahan; diakses dalam transaksi pembuat dokumen.

## D-007 — Default kebijakan stok negatif: TIDAK DIIZINKAN
- **What:** Checkout ditolak bila stok tidak cukup; configurable per store.
- **Why:** PRD §17.3: kebijakan configurable; default aman untuk MVP.
- **Impact:** Perlu tabel/konfigurasi store setting.

## D-008 — HPP sementara = `purchase_price` terakhir
- **What:** Profit report MVP memakai purchase price sebagai HPP (asumsi).
- **Why:** Definisi HPP final belum disepakati (PRD §25.6, item B1).
- **Impact:** Ditandai asumsi; wajib direview sebelum Milestone 8.

## D-009 — Pajak: opsional, default 0
- **What:** Field tax rate per item; default 0 (tanpa full tax engine).
- **Why:** Full tax engine out of scope MVP (PRD §41).
- **Impact:** Struktur siap bila pajak dibutuhkan.

## D-010 — QRIS: pencatatan manual sebagai payment method
- **What:** Tanpa integrasi gateway di MVP.
- **Why:** Integrasi payment = Could Have (PRD §40).
- **Impact:** Kasir input nominal QRIS manual; rekonsiliasi manual.

## D-011 — Frontend: React Navigation + Zustand + axios
- **What:** Navigasi, state management, HTTP client.
- **Why:** Ringan, populer, cukup untuk POS mobile.
- **Impact:** Standar untuk semua modul mobile.
