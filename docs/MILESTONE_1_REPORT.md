# Milestone 1 — Auth & RBAC — Completion Report

Tanggal: 2026-10-08
Status: **SELESAI** — 19/19 test lolos, 13/13 skenario E2E lolos.

## Completed

- JWT auth: access token 15 menit + opaque refresh token 7 hari dengan rotation.
- Refresh token disimpan sebagai hash SHA-256; reuse terdeteksi → semua sesi user dicabut (transaksi independen, tidak ikut rollback).
- RBAC: 7 role (OWNER, ADMIN, MANAJER, KASIR, GUDANG, KEUANGAN, AUDITOR) + 39 permission, di-seed via Flyway.
- Otorisasi backend via `@PreAuthorize("hasAuthority('...')")`; menu mobile difilter berdasar permission (UX saja).
- User yang nonaktif ditolak meski token valid (cek fresh ke DB per request).
- Mobile: layar login, token persistence (AsyncStorage), auto-refresh single-flight, menu berdasar permission, logout.

## Files Changed

Backend (`backend/src/main/java/com/tugaskuliah/pos/`):
- `common/response/ApiResponse.java` — envelope standar `{success,message,data,pagination?}`
- `common/exception/` — `ErrorCode`, `ApiException`, `GlobalExceptionHandler`
- `common/security/` — `JwtService`, `JwtAuthenticationFilter`, `CustomUserDetailsService`, `UserPrincipal`, `SecurityConfig`
- `auth/` — entity `RefreshToken`, repository, `AuthService`, `AuthController`, DTO
- `user/` — entity `User/Role/Permission`, repository, `UserService`, `UserController`, `RoleController`, mapper, DTO

Flyway (`backend/src/main/resources/db/migration/`):
- `V1__auth_schema.sql` — tabel users, roles, permissions, user_roles, role_permissions, refresh_tokens
- `V2__seed_auth.sql` — 7 role, 39 permission, mapping, admin default

Mobile (`mobile/src/`):
- `config.ts`, `types/api.ts`, `services/api.ts` (+interceptor refresh), `services/authApi.ts`
- `stores/authStore.ts` (Zustand + persist), `modules/auth/LoginScreen.tsx`, `app/navigation.tsx`

Config: `backend/pom.xml` (surefire IPv4, spring-boot-starter-test), `backend/.mvn/jvm.config`, `backend/README.md`.

## Database Changes

- V1: tabel `users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `refresh_tokens` (FK + index).
- V2: seed 7 role, 39 permission, relasi role↔permission, user `admin` (OWNER).

## API Changes

| Method | Path | Keterangan |
|---|---|---|
| POST | `/api/v1/auth/login` | public |
| POST | `/api/v1/auth/refresh` | public, rotasi + deteksi reuse |
| POST | `/api/v1/auth/logout` | public, butuh refresh token di body |
| GET | `/api/v1/auth/me` | butuh Bearer token |
| GET/POST/PUT/DELETE | `/api/v1/users` | `user.view/create/update/delete` |
| GET | `/api/v1/roles`, `/api/v1/permissions` | `user.view` |

## Frontend Changes

- Login screen (loading/error, submit via keyboard).
- Auth store persisten; axios interceptor auto-refresh (single-flight).
- Menu dinamis: POS, Produk, Users, Reports — tampil sesuai permission.
- Placeholder untuk milestone berikutnya.

## Business Rules Implemented

1. Password di-hash BCrypt, tidak pernah plaintext.
2. Refresh token rotation; token lama langsung tidak berlaku.
3. Reuse refresh token = indikasi pencurian → cabut semua sesi user.
4. User nonaktif tidak bisa login dan tokennya ditolak.
5. Otorisasi di backend; frontend hanya UX.

## Tests

`./mvnw test` — **19/19 lolos** (0 failure, 0 error):
- `AuthServiceTest` (7): login sukses/gagal, user nonaktif, rotasi refresh, deteksi reuse, logout.
- `AuthIntegrationTest` (11): login, me, refresh, logout, validasi input, RBAC kasir 403 vs admin 200, buat user + login.
- `PosBackendApplicationTests` (1): context load.

E2E manual terhadap app berjalan (13/13): health, login valid/invalid, me, 401 tanpa token, 401 token invalid, rotasi refresh, reuse ditolak, logout, refresh pasca-logout ditolak, kasir 403, admin 200, list roles.

## Acceptance Criteria — PASS/FAIL

| Kriteria | Hasil |
|---|---|
| Login valid dapat access+refresh token | PASS |
| Login invalid/nonaktif ditolak | PASS |
| Refresh rotation, token lama mati | PASS |
| Reuse → semua sesi dicabut | PASS |
| Logout mencabut refresh token | PASS |
| Endpoint proteksi tanpa token → 401 | PASS |
| Kasir akses user management → 403 | PASS |
| Skema via Flyway, reproducible | PASS |
| Mobile login + menu berdasar permission | PASS (logic; UI emulator belum) |

## Known Issues

1. **Akun admin default di-seed** (`admin`/`admin123`, V2). Wajib diganti/dinonaktifkan sebelum production; idealnya diganti bootstrap sekali-pakai.
2. **Audit log belum ada** — perubahan user/role dan login/logout belum dicatat. Dijadwalkan di Milestone 7 (Control/Audit).
3. **UI mobile belum diverifikasi di emulator** — hanya type-check (`tsc`) yang lolos.
4. Secret default di `application.yml` hanya untuk dev; production wajib via env var.

## Technical Debt

- Spring Boot 4.1.1 (Initializr tidak lagi menyediakan 3.x). `AutoConfigureMockMvc` tidak tersedia → test pakai `MockMvcBuilders` + `springSecurity()` manual. Dicatat di `docs/DECISIONS.md` D-002.
- `spring-boot-starter-test` perlu ditambahkan eksplisit (tidak ikut starter lain).
- Surefire butuh `-Djava.net.preferIPv4Stack=true` di environment sandbox ini (IPv6 diblokir).

## Next Recommended Milestone

**Milestone 2 — Master Data** (kategori, produk, supplier, pelanggan, payment method) — dependensi langsung untuk POS.
