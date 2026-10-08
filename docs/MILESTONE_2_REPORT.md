# Milestone 2 — Master Data — Completion Report

Tanggal: 2026-10-08
Status: **SELESAI** — 5/5 test backend lolos, mobile tsc lolos.

## Completed

- Kategori (dengan parent opsional), satuan, produk, varian produk.
- SKU unik (produk & varian), barcode unik, harga non-negatif (CHECK constraint).
- Histori harga: setiap perubahan harga beli/jual tercatat di `product_prices` (old, new, reason, changed_by).
- Customer (dengan GENERAL CUSTOMER default), supplier, payment methods (CASH, QRIS, DEBIT, CREDIT_CARD, TRANSFER).
- Permission baru: `customer.view/create/update`, `supplier.view/create/update` + mapping ke role.
- Mobile: daftar produk + search, form tambah/edit produk.

## Files Changed

Backend (`backend/src/main/java/com/tugaskuliah/pos/masterdata/`):
- `entity/`: Category, Unit, Product, ProductVariant, ProductPrice, Customer, Supplier, PaymentMethod
- `repository/`: 8 repository (dengan search query untuk Product)
- `dto/`: 11 request/response records
- `service/`: ProductService (+price history), CategoryService, CustomerService, SupplierService
- `controller/`: ProductController, CategoryController, CustomerController, SupplierController

Flyway: `V3__master_data.sql` (tabel + seeds + permission baru).

Mobile (`mobile/src/`):
- `services/productApi.ts`
- `modules/products/ProductListScreen.tsx`, `ProductFormScreen.tsx`
- `app/navigation.tsx` (route produk)

## Database Changes

- V3: `categories`, `units`, `products`, `product_variants`, `product_prices`, `customers`, `suppliers`, `payment_methods`.
- Seeds: 5 unit, 5 payment method, 1 GENERAL customer, 6 permission + role mapping.

## API Changes

| Method | Path | Permission |
|---|---|---|
| GET/POST | `/api/v1/products?search=&categoryId=&activeOnly=` | product.view / create |
| GET/PUT | `/api/v1/products/{id}` | product.view / update |
| PUT | `/api/v1/products/{id}/price` | product.price.update |
| GET | `/api/v1/products/{id}/price-history` | product.view |
| GET/POST/PUT | `/api/v1/categories` | product.view / create / update |
| GET/POST/PUT | `/api/v1/customers` | customer.view / create / update |
| GET/POST/PUT | `/api/v1/suppliers` | supplier.view / create / update |

## Business Rules Implemented

1. SKU harus unik — duplikat ditolak 409.
2. Barcode unik jika diisi.
3. Harga (beli/jual) dan stok minimum tidak boleh negatif.
4. Setiap perubahan harga tercatat di histori (audit trail).
5. Kategori tidak bisa menjadi parent dirinya sendiri.
6. Produk inactive tetap tersimpan tapi difilter dari daftar aktif.

## Tests

`ProductIntegrationTest` — **5/5 lolos**:
- createProduct_success
- createProduct_duplicateSku_rejected (409)
- updatePrice_recordsHistory (old 7500 → new 9000 tercatat)
- kasir_cannotCreateProduct_403
- searchProduct_byName

Mobile: `npx tsc --noEmit` lolos.

## Known Issues

1. Full backend test suite (M1+M2) dan E2E manual belum dijalankan ulang setelah VM environment di-replace (Java/PostgreSQL/Maven repo hilang). M2 tests (5/5) lolos sebelum VM replacement.
2. Audit log PRICE_CHANGE formal (tabel audit) dijadwalkan Milestone 7; saat ini tercatat di `product_prices`.
3. Sort/filter lanjutan (by price range, dll) belum ada — pagination + search + filter kategori/active sudah.

## Technical Debt

- Kolom `permissions.group_name` (bukan `module`) — V3 diperbaiki sebelum test lolos.
- Product variant CRUD endpoint belum diekspos (entity & repo siap, API menyusul jika dibutuhkan POS).

## Next Recommended Milestone

**Milestone 3 — POS / Sales** (checkout, cart, payment, receipt) — dependensi: master data sudah stabil.
