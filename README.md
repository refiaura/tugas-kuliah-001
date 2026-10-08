# tugas-kuliah-001 — Aplikasi Kasir / POS

Sistem Point of Sale + operasional toko: penjualan, shift kasir, inventory,
pembelian, retur/void/refund dengan approval, audit trail, dan laporan.

**PRD:** `docs/` (single source of truth) — mulai dari `docs/PROJECT_ASSESSMENT.md`.

## Struktur

```
├── mobile/    # React Native 0.87.1 (TypeScript) — aplikasi kasir
├── backend/   # Spring Boot REST API (dalam pengerjaan, mulai Milestone 1)
└── docs/      # assessment, arsitektur, gap analysis, backlog, keputusan
```

## Status

**Milestone 0 — Assessment selesai.** Lihat `docs/BACKLOG.md` untuk urutan implementasi
(Phase 0 → 9: Auth → Master Data → POS → Shift → Inventory → Purchase →
Control → Reports → Hardening).

## Menjalankan mobile app (sementara)

```sh
cd mobile
npm install
npx react-native run-android   # atau run-ios
```
