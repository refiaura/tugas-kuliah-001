# Backend — POS Tugas Kuliah 001

Spring Boot 4.1.1 + Java 21 + Maven + PostgreSQL + Flyway.

## Prasyarat

- JDK 21
- Maven 3.9+ (atau pakai `./mvnw`)
- PostgreSQL 16

## Setup database (sekali saja)

```sql
CREATE ROLE pos WITH LOGIN PASSWORD 'pos' CREATEDB;
CREATE DATABASE pos_db OWNER pos;
CREATE DATABASE pos_test OWNER pos;
```

## Konfigurasi

Jangan commit secret. Untuk lokal, cukup pakai default di bawah (DEV ONLY).
Untuk deployment, override via environment variable:

| Property | Env var | Default (dev) |
|---|---|---|
| `spring.datasource.url` | `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/pos_db?sslmode=disable` |
| `spring.datasource.username` | `SPRING_DATASOURCE_USERNAME` | `pos` |
| `spring.datasource.password` | `SPRING_DATASOURCE_PASSWORD` | `pos` |
| `jwt.secret` | `JWT_SECRET` | dev-only (min 32 byte) |

Contoh `.env` (jangan commit):

```sh
export SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/pos_db
export SPRING_DATASOURCE_USERNAME=pos
export SPRING_DATASOURCE_PASSWORD=pos
export JWT_SECRET=$(openssl rand -base64 48)
```

## Jalanin

```sh
cd backend
./mvnw spring-boot:run
# atau:
./mvnw package -DskipTests
java -jar target/pos-backend-0.0.1-SNAPSHOT.jar
```

Flyway menjalankan migrasi otomatis saat start (`V1__auth_schema.sql`, `V2__seed_auth.sql`).

## Test

```sh
./mvnw test
```

Test memakai database `pos_test` (dibuat terpisah agar tidak mengganggu data dev).

## Akun default (DEV ONLY)

- username: `admin` / password: `admin123` (role OWNER)
- Ganti segera setelah login pertama. Jangan pakai di production.

## API (Milestone 1)

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| POST | `/api/v1/auth/login` | — | Login, dapat access+refresh token |
| POST | `/api/v1/auth/refresh` | — | Rotasi refresh token |
| POST | `/api/v1/auth/logout` | — | Cabut refresh token |
| GET | `/api/v1/auth/me` | Bearer | Profil user login |
| GET/POST | `/api/v1/users` | `user.view` / `user.create` | Kelola user |
| GET | `/api/v1/roles` | `user.view` | Daftar role |
| GET | `/api/v1/permissions` | `user.view` | Daftar permission |

Semua response memakai envelope `{success, message, data, pagination?}`.
