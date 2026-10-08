# Panduan Setup — dari Nol sampai Jalan

Untuk menjalankan aplikasi kasir ini di laptop (Windows/Mac/Linux).

## 1. Yang harus diinstall

| Kebutuhan | Versi | Download |
|---|---|---|
| Java (JDK) | 21 | [adoptium.net](https://adoptium.net/temurin/releases/?version=21) |
| PostgreSQL | 16 | [postgresql.org/download](https://www.postgresql.org/download/) |
| Node.js | 20+ (LTS) | [nodejs.org](https://nodejs.org/) |
| Android Studio | terbaru | [developer.android.com](https://developer.android.com/studio) — untuk emulator Android |

Cek instalasi:

```sh
java -version      # harus 21.x
psql --version     # 16.x
node --version     # v20+
```

## 2. Clone repo

```sh
git clone https://github.com/refiaura/tugas-kuliah-001.git
cd tugas-kuliah-001
```

## 3. Setup database (sekali saja)

Buka `psql` (atau pgAdmin → Query Tool) sebagai superuser `postgres`:

```sql
CREATE ROLE pos WITH LOGIN PASSWORD 'pos' CREATEDB;
CREATE DATABASE pos_db OWNER pos;
CREATE DATABASE pos_test OWNER pos;
```

## 4. Jalankan backend

```sh
cd backend
./mvnw spring-boot:run
```

Di Windows pakai `mvnw.cmd`:

```cmd
cd backend
mvnw.cmd spring-boot:run
```

Tunggu sampai muncul `Started PosBackendApplication`. Flyway otomatis membuat tabel + seed data.

Verifikasi — buka di browser atau curl:

```sh
curl http://localhost:8080/actuator/health
# → {"status":"UP", ...}
```

Login test:

```sh
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Akun default (DEV ONLY, ganti setelah login):
- username: `admin` / password: `admin123` (role OWNER)

> Backend jalan di `http://localhost:8080`. Jangan matikan terminal ini selama testing.

## 5. Jalankan mobile

Buka **terminal baru**:

```sh
cd tugas-kuliah-001/mobile
npm install
```

### Atur alamat backend

Edit `mobile/src/config.ts`, sesuaikan `API_BASE_URL`:

| Target | URL |
|---|---|
| Emulator Android | `http://10.0.2.2:8080` (default, sudah benar) |
| Simulator iOS | `http://localhost:8080` |
| HP fisik (satu WiFi) | `http://<IP-laptop>:8080` — contoh `http://192.168.1.10:8080` |

### Jalankan

```sh
# terminal 1 — Metro bundler
npm start

# terminal 2 — install & buka di emulator/HP
npm run android   # atau: npm run ios  (Mac saja)
```

Untuk HP fisik Android: aktifkan USB debugging, colok kabel, lalu `npm run android`.
Pastikan HP dan laptop satu jaringan WiFi jika pakai IP LAN.

### Login di aplikasi

Pakai akun yang sama: `admin` / `admin123`.

## 6. Troubleshooting

| Masalah | Solusi |
|---|---|
| `java: command not found` | JDK 21 belum terinstall / JAVA_HOME belum diset |
| Backend gagal konek DB | Cek PostgreSQL jalan; cek role `pos` dan database `pos_db` ada |
| Mobile "Network request failed" | Salah `API_BASE_URL`; backend belum jalan; firewall blokir port 8080 |
| Port 8080 sudah dipakai | Matikan aplikasi lain yang pakai 8080, atau ubah `server.port` di `backend/src/main/resources/application.yml` |
| Emulator Android lambat | Wajar di pertama kali; aktifkan hardware acceleration (HAXM/Hyper-V) |

## 7. Perintah berguna

```sh
# backend — jalanin test
cd backend && ./mvnw test

# backend — build jar
cd backend && ./mvnw package -DskipTests
java -jar target/pos-backend-0.0.1-SNAPSHOT.jar

# mobile — cek TypeScript
cd mobile && npx tsc --noEmit
```

## 8. Checklist sebelum production

Jangan deploy ke production sebelum semua ini beres:

- [ ] Ganti JWT secret: set env `JWT_SECRET` (min. 32 byte acak). Jangan pakai
      default `dev-secret-key-...`.
- [ ] Ganti password akun `admin` (default `admin123` hanya untuk dev).
- [ ] PostgreSQL: user `pos` jangan pakai password `pos`; batasi akses network.
- [ ] Backend: set `spring.profiles.active=prod` bila ada konfigurasi prod.
- [ ] Mobile: `API_BASE_URL` menunjuk ke server production (HTTPS).
- [ ] Jalankan full test suite: `cd backend && ./mvnw test` — semua harus hijau.
- [ ] Backup database terjadwal.
- [ ] Login brute-force: proteksi 5x gagal → lockout 5 menit sudah aktif
      (in-memory; untuk multi-instance pindahkan ke Redis/DB).
