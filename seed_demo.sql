-- ============================================================
-- SEED DATA untuk testing di HP (jalankan sekali saja)
-- Cara pakai:
--   psql -U pos -d pos_db -f seed_demo.sql
--
-- Semua user pakai password: admin123
-- ============================================================

-- ---------- users per role ----------
-- password_hash di bawah = bcrypt("admin123"), sama seperti user admin

INSERT INTO users (username, password_hash, full_name, email, is_active) VALUES
('supervisor1', '$2b$10$Y1ysC9ssMkZ8sabSaPrO1epGRCjfMXYbmNO28H3iTVDyzvgkc11r2', 'Supervisor Satu', 'supervisor1@local', TRUE),
('kasir1',      '$2b$10$Y1ysC9ssMkZ8sabSaPrO1epGRCjfMXYbmNO28H3iTVDyzvgkc11r2', 'Kasir Satu',      'kasir1@local',      TRUE),
('gudang1',     '$2b$10$Y1ysC9ssMkZ8sabSaPrO1epGRCjfMXYbmNO28H3iTVDyzvgkc11r2', 'Gudang Satu',     'gudang1@local',     TRUE),
('purchasing1', '$2b$10$Y1ysC9ssMkZ8sabSaPrO1epGRCjfMXYbmNO28H3iTVDyzvgkc11r2', 'Purchasing Satu', 'purchasing1@local', TRUE),
('accounting1', '$2b$10$Y1ysC9ssMkZ8sabSaPrO1epGRCjfMXYbmNO28H3iTVDyzvgkc11r2', 'Accounting Satu', 'accounting1@local', TRUE),
('admin2',      '$2b$10$Y1ysC9ssMkZ8sabSaPrO1epGRCjfMXYbmNO28H3iTVDyzvgkc11r2', 'Admin Dua',       'admin2@local',      TRUE)
ON CONFLICT (username) DO NOTHING;

INSERT INTO users_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE (u.username = 'supervisor1' AND r.name = 'SUPERVISOR')
   OR (u.username = 'kasir1'      AND r.name = 'KASIR')
   OR (u.username = 'gudang1'     AND r.name = 'GUDANG')
   OR (u.username = 'purchasing1' AND r.name = 'PURCHASING')
   OR (u.username = 'accounting1' AND r.name = 'ACCOUNTING')
   OR (u.username = 'admin2'      AND r.name = 'ADMIN')
ON CONFLICT DO NOTHING;

-- ---------- categories ----------
INSERT INTO categories (name, is_active) VALUES
('Makanan', TRUE),
('Minuman', TRUE),
('Snack', TRUE),
('Kebersihan', TRUE),
('ATK', TRUE)
ON CONFLICT DO NOTHING;

-- ---------- suppliers ----------
INSERT INTO suppliers (supplier_code, name, phone, address, is_active) VALUES
('SUP-001', 'PT Sumber Makmur', '021-5550123', 'Jl. Merdeka No. 10, Jakarta', TRUE),
('SUP-002', 'CV Berkah Jaya', '021-5550456', 'Jl. Sudirman No. 88, Bandung', TRUE),
('SUP-003', 'PT Indo Distribusi', '021-5550789', 'Jl. Gatot Subroto No. 5, Surabaya', TRUE)
ON CONFLICT (supplier_code) DO NOTHING;

-- ---------- customers ----------
INSERT INTO customers (customer_code, name, phone, member_status, is_active) VALUES
('CUST-001', 'Budi Santoso', '081234567890', 'REGULAR', TRUE),
('CUST-002', 'Siti Aminah', '081234567891', 'MEMBER', TRUE),
('CUST-003', 'Toko Kelontong Barokah', '081234567892', 'REGULAR', TRUE)
ON CONFLICT DO NOTHING;

-- ---------- products ----------
-- butuh category_id & unit_id; ambil via subquery agar id-agnostic
WITH cat AS (SELECT id, name FROM categories),
     unt AS (SELECT id, code FROM units)
INSERT INTO products (sku, barcode, name, category_id, unit_id, purchase_price, selling_price, minimum_stock, is_active)
SELECT v.sku, v.barcode, v.name,
       (SELECT id FROM cat WHERE name = v.cat_name),
       (SELECT id FROM unt WHERE code = 'PCS'),
       v.buy, v.sell, v.min_stock, TRUE
FROM (VALUES
    ('MKN-001', '8990011010011', 'Indomie Goreng',              'Makanan',    2800,  3500, 20),
    ('MKN-002', '8990011010028', 'Indomie Soto',                'Makanan',    2800,  3500, 20),
    ('MKN-003', '8990011010035', 'Beras Premium 5kg',           'Makanan',   62000, 70000, 10),
    ('MKN-004', '8990011010042', 'Minyak Goreng 2L',            'Makanan',   38000, 44000, 10),
    ('MKN-005', '8990011010059', 'Gula Pasir 1kg',              'Makanan',   16500, 19000, 15),
    ('MNM-001', '8990011020010', 'Aqua 600ml',                  'Minuman',    2800,  4000, 24),
    ('MNM-002', '8990011020027', 'Teh Botol Sosro 450ml',       'Minuman',    3200,  4500, 24),
    ('MNM-003', '8990011020034', 'Kopi Kapal Api 165g',         'Minuman',    9500, 12000, 15),
    ('MNM-004', '8990011020041', 'Susu UHT Full Cream 1L',      'Minuman',   17500, 21000, 12),
    ('SNK-001', '8990011030019', 'Chitato Sapi Panggang 68g',   'Snack',      9500, 12000, 20),
    ('SNK-002', '8990011030026', 'Taro Net 65g',                'Snack',      8500, 11000, 20),
    ('SNK-003', '8990011030033', 'Beng-Beng 20g',               'Snack',      1800,  2500, 30),
    ('KBH-001', '8990011040018', 'Sunlight 755ml',              'Kebersihan', 18500, 22500, 10),
    ('KBH-002', '8990011040025', 'Rinso Anti Noda 800g',        'Kebersihan', 19500, 23500, 10),
    ('ATK-001', '8990011050017', 'Pulpen Standard AE7',         'ATK',        2200,  3500, 30)
) AS v(sku, barcode, name, cat_name, buy, sell, min_stock)
ON CONFLICT (sku) DO NOTHING;

-- ---------- initial stock (via stock receipt, agar tercatat di movement ledger) ----------
-- Catatan: stok awal diinput lewat aplikasi (menu Stok > Terima Barang) agar
-- tercatat properly di stock_movements. Bagian ini sengaja dikosongkan.

SELECT 'Seed selesai. Login dengan:' AS info
UNION ALL SELECT '  admin / admin123       (OWNER)'
UNION ALL SELECT '  supervisor1 / admin123 (SUPERVISOR)'
UNION ALL SELECT '  kasir1 / admin123      (KASIR)'
UNION ALL SELECT '  gudang1 / admin123     (GUDANG)'
UNION ALL SELECT '  purchasing1 / admin123 (PURCHASING)'
UNION ALL SELECT '  accounting1 / admin123 (ACCOUNTING)'
UNION ALL SELECT '  admin2 / admin123      (ADMIN)';
