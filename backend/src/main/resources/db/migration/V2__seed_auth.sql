-- V2: Seed roles, permissions, default admin (idempotent, Milestone 1)
-- Default admin: username 'admin' / password 'admin123' (change after first login!)

-- ---------- permissions ----------
INSERT INTO permissions (code, name, group_name) VALUES
-- user
('user.view','View users','user'),
('user.create','Create users','user'),
('user.update','Update users','user'),
('user.delete','Delete users','user'),
-- product
('product.view','View products','product'),
('product.create','Create products','product'),
('product.update','Update products','product'),
('product.delete','Delete products','product'),
('product.price.update','Update product price','product'),
-- sales
('sales.view','View sales','sales'),
('sales.create','Create sales','sales'),
('sales.void','Void sales','sales'),
('sales.refund','Refund sales','sales'),
('sales.return','Return sales','sales'),
('sales.discount','Apply discount','sales'),
-- inventory
('stock.view','View stock','inventory'),
('stock.adjustment','Adjust stock','inventory'),
('stock.opname','Stock opname','inventory'),
('stock.transfer','Transfer stock','inventory'),
('stock.receive','Receive stock','inventory'),
-- purchase
('purchase.view','View purchases','purchase'),
('purchase.create','Create purchases','purchase'),
('purchase.approve','Approve purchases','purchase'),
('purchase.receive','Receive purchases','purchase'),
('purchase.return','Return purchases','purchase'),
-- cashier
('shift.open','Open shift','cashier'),
('shift.close','Close shift','cashier'),
('cash.in','Cash in','cashier'),
('cash.out','Cash out','cashier'),
('cash.reconcile','Reconcile cash','cashier'),
-- report
('report.sales','Sales report','report'),
('report.stock','Stock report','report'),
('report.cash','Cash report','report'),
('report.purchase','Purchase report','report'),
('report.profit','Profit report','report'),
-- approval
('approval.view','View approvals','approval'),
('approval.approve','Approve requests','approval'),
('approval.reject','Reject requests','approval')
ON CONFLICT (code) DO NOTHING;

-- ---------- roles ----------
INSERT INTO roles (name, description, is_system) VALUES
('OWNER','Business owner - full access',TRUE),
('ADMIN','Administrator - master data & users',TRUE),
('SUPERVISOR','Supervisor - approvals & operational control',TRUE),
('KASIR','Cashier - sales & shift',TRUE),
('GUDANG','Warehouse - stock & goods receipt',TRUE),
('PURCHASING','Purchasing - PO & suppliers',TRUE),
('ACCOUNTING','Accounting - cash & financial reports',TRUE)
ON CONFLICT (name) DO NOTHING;

-- ---------- role_permissions ----------
-- helper: grant(permission_code, role_name)
WITH grant_perm AS (
    SELECT * FROM (VALUES
        -- OWNER: everything
        ('user.view','OWNER'),('user.create','OWNER'),('user.update','OWNER'),('user.delete','OWNER'),
        ('product.view','OWNER'),('product.create','OWNER'),('product.update','OWNER'),('product.delete','OWNER'),('product.price.update','OWNER'),
        ('sales.view','OWNER'),('sales.create','OWNER'),('sales.void','OWNER'),('sales.refund','OWNER'),('sales.return','OWNER'),('sales.discount','OWNER'),
        ('stock.view','OWNER'),('stock.adjustment','OWNER'),('stock.opname','OWNER'),('stock.transfer','OWNER'),('stock.receive','OWNER'),
        ('purchase.view','OWNER'),('purchase.create','OWNER'),('purchase.approve','OWNER'),('purchase.receive','OWNER'),('purchase.return','OWNER'),
        ('shift.open','OWNER'),('shift.close','OWNER'),('cash.in','OWNER'),('cash.out','OWNER'),('cash.reconcile','OWNER'),
        ('report.sales','OWNER'),('report.stock','OWNER'),('report.cash','OWNER'),('report.purchase','OWNER'),('report.profit','OWNER'),
        ('approval.view','OWNER'),('approval.approve','OWNER'),('approval.reject','OWNER'),
        -- ADMIN
        ('user.view','ADMIN'),('user.create','ADMIN'),('user.update','ADMIN'),('user.delete','ADMIN'),
        ('product.view','ADMIN'),('product.create','ADMIN'),('product.update','ADMIN'),('product.price.update','ADMIN'),
        ('sales.view','ADMIN'),('sales.create','ADMIN'),('sales.discount','ADMIN'),
        ('stock.view','ADMIN'),
        ('purchase.view','ADMIN'),('purchase.create','ADMIN'),
        ('report.sales','ADMIN'),('report.stock','ADMIN'),('report.cash','ADMIN'),('report.purchase','ADMIN'),('report.profit','ADMIN'),
        -- SUPERVISOR
        ('product.view','SUPERVISOR'),('product.create','SUPERVISOR'),('product.update','SUPERVISOR'),('product.price.update','SUPERVISOR'),
        ('sales.view','SUPERVISOR'),('sales.create','SUPERVISOR'),('sales.void','SUPERVISOR'),('sales.refund','SUPERVISOR'),('sales.return','SUPERVISOR'),('sales.discount','SUPERVISOR'),
        ('stock.view','SUPERVISOR'),('stock.adjustment','SUPERVISOR'),('stock.opname','SUPERVISOR'),('stock.transfer','SUPERVISOR'),('stock.receive','SUPERVISOR'),
        ('purchase.view','SUPERVISOR'),('purchase.create','SUPERVISOR'),('purchase.approve','SUPERVISOR'),('purchase.receive','SUPERVISOR'),
        ('shift.open','SUPERVISOR'),('shift.close','SUPERVISOR'),('cash.in','SUPERVISOR'),('cash.out','SUPERVISOR'),('cash.reconcile','SUPERVISOR'),
        ('report.sales','SUPERVISOR'),('report.stock','SUPERVISOR'),('report.cash','SUPERVISOR'),('report.purchase','SUPERVISOR'),('report.profit','SUPERVISOR'),
        ('approval.view','SUPERVISOR'),('approval.approve','SUPERVISOR'),('approval.reject','SUPERVISOR'),
        -- KASIR
        ('product.view','KASIR'),
        ('sales.view','KASIR'),('sales.create','KASIR'),('sales.discount','KASIR'),
        ('stock.view','KASIR'),
        ('shift.open','KASIR'),('shift.close','KASIR'),('cash.in','KASIR'),('cash.out','KASIR'),('cash.reconcile','KASIR'),
        -- GUDANG
        ('product.view','GUDANG'),
        ('stock.view','GUDANG'),('stock.adjustment','GUDANG'),('stock.opname','GUDANG'),('stock.transfer','GUDANG'),('stock.receive','GUDANG'),
        ('purchase.receive','GUDANG'),
        -- PURCHASING
        ('product.view','PURCHASING'),
        ('stock.view','PURCHASING'),
        ('purchase.view','PURCHASING'),('purchase.create','PURCHASING'),('purchase.receive','PURCHASING'),
        -- ACCOUNTING
        ('product.view','ACCOUNTING'),
        ('sales.view','ACCOUNTING'),('sales.create','ACCOUNTING'),
        ('stock.view','ACCOUNTING'),
        ('purchase.view','ACCOUNTING'),
        ('shift.open','ACCOUNTING'),('shift.close','ACCOUNTING'),('cash.in','ACCOUNTING'),('cash.out','ACCOUNTING'),('cash.reconcile','ACCOUNTING'),
        ('report.sales','ACCOUNTING'),('report.stock','ACCOUNTING'),('report.cash','ACCOUNTING'),('report.purchase','ACCOUNTING'),('report.profit','ACCOUNTING')
    ) AS v(perm_code, role_name)
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM grant_perm g
JOIN roles r ON r.name = g.role_name
JOIN permissions p ON p.code = g.perm_code
ON CONFLICT DO NOTHING;

-- ---------- default admin user (admin / admin123) ----------
INSERT INTO users (username, password_hash, full_name, email, is_active)
VALUES ('admin', '$2b$10$Y1ysC9ssMkZ8sabSaPrO1epGRCjfMXYbmNO28H3iTVDyzvgkc11r2', 'Administrator', 'admin@local', TRUE)
ON CONFLICT (username) DO NOTHING;

INSERT INTO users_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.username = 'admin' AND r.name = 'OWNER'
ON CONFLICT DO NOTHING;
