# Milestone 9 Report — Hardening

**Tanggal:** 2026-10-08
**Commit:** (lihat git log)

## Ringkasan

Milestone 9 (hardening) memperbaiki compile error yang tertinggal dari
milestone sebelumnya, menambahkan proteksi brute-force login, dan menambah
production checklist. Unit test berjalan hijau. Integration test (butuh
PostgreSQL) belum bisa dijalankan di environment ini — harus dijalankan di
laptop dev.

## Perbaikan compile error

1. **Jackson 2 → Jackson 3.** Spring Boot 4.1 memakai `tools.jackson`
   (Jackson 3). `AuditService` mengimpor `com.fasterxml.jackson.databind`
   yang hanya tersedia di scope `runtime` (via jjwt) → compile gagal.
   Diperbaiki: pakai `tools.jackson.databind.ObjectMapper` dan inject sebagai
   Spring bean (bukan `new ObjectMapper()`).
2. **`AuditService.log` signature.** Beberapa pemanggil mengoper `Long`
   sebagai `entityId` ke overload yang mengharapkan `String`. Diperbaiki:
   parameter menjadi `Object`, dikonversi via `String.valueOf()` di dalam.
3. **`AuthServiceTest` ketinggalan.** Konstruktor `AuthService` bertambah
   parameter `AuditService` (M7) tapi test tidak diupdate → test-compile gagal.
   Diperbaiki: tambah mock `AuditService`.

## Hardening baru

1. **Brute-force protection** (`LoginAttemptService`):
   - 5x login gagal → lockout 5 menit (HTTP 429, `AUTH_TOO_MANY_ATTEMPTS`).
   - Counter reset saat login sukses; window tracking 10 menit.
   - In-memory (cukup untuk single-instance; multi-instance → Redis/DB).
   - 2 test baru di `AuthServiceTest` (lockout + reset counter).
2. **Production checklist** di `docs/SETUP.md` (§8): JWT secret, password admin,
   kredensial DB, HTTPS, full test suite, backup, catatan brute-force.

## Review keamanan (lolos)

- Semua endpoint non-auth terproteksi `@PreAuthorize` (RBAC backend).
- `/api/v1/auth/*` public sesuai desain; `/me` butuh autentikasi.
- Tidak ada password hash di response DTO; tidak ada stack trace bocor ke client.
- Semua `@RequestBody` pakai `@Valid` (satu pengecualian: `Set<String>`
  permission codes di RoleController — tipe primitif, risiko rendah).
- JWT secret: default dev + validasi min 32 byte + override via `JWT_SECRET`.
- CSRF disabled (tepat untuk API stateless JWT); session stateless.

## Testing

| Test | Hasil |
|---|---|
| `mvnw compile` (main) | ✅ lolos |
| `mvnw test-compile` | ✅ lolos |
| `AuthServiceTest` (9 test, termasuk 2 baru) | ✅ 9/9 lolos |
| Integration test M1–M8 (`*IntegrationTest`) | ⏳ **belum dijalankan** — butuh PostgreSQL (`pos_test`). Sandbox ini tidak menyediakan PostgreSQL dan package tidak tersedia di apt. |

### Yang harus dijalankan di laptop dev

```sh
cd backend
./mvnw test
```

Pastikan PostgreSQL jalan dan database `pos_test` + role `pos` tersedia
(lihat `docs/SETUP.md`). Semua test harus hijau sebelum dianggap production-ready.

## Batasan yang diketahui

- Rate limiter login bersifat in-memory (single-instance).
- Push notification / email / WhatsApp tetap future (PRD §27).
- Export laporan PDF/Excel belum diimplementasikan.
