-- V3: Master Data (Milestone 2)
-- categories, units, products, product_variants, product_prices,
-- customers, suppliers, payment_methods + seeds.
-- Money: NUMERIC(19,2). Idempotent seeds via ON CONFLICT DO NOTHING.

-- ---------- categories ----------
CREATE TABLE categories (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    parent_id   BIGINT REFERENCES categories(id),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_categories_parent ON categories(parent_id);

-- ---------- units ----------
CREATE TABLE units (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(20) NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------- products ----------
CREATE TABLE products (
    id              BIGSERIAL PRIMARY KEY,
    sku             VARCHAR(50) NOT NULL UNIQUE,
    barcode         VARCHAR(50) UNIQUE,
    name            VARCHAR(200) NOT NULL,
    category_id     BIGINT REFERENCES categories(id),
    unit_id         BIGINT NOT NULL REFERENCES units(id),
    purchase_price  NUMERIC(19,2) NOT NULL DEFAULT 0,
    selling_price   NUMERIC(19,2) NOT NULL DEFAULT 0,
    minimum_stock   NUMERIC(19,2) NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      VARCHAR(50),
    updated_by      VARCHAR(50),
    CONSTRAINT chk_product_prices_nonneg CHECK (purchase_price >= 0 AND selling_price >= 0 AND minimum_stock >= 0)
);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active);

-- ---------- product_variants ----------
CREATE TABLE product_variants (
    id              BIGSERIAL PRIMARY KEY,
    product_id      BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    sku             VARCHAR(50) NOT NULL UNIQUE,
    barcode         VARCHAR(50) UNIQUE,
    purchase_price  NUMERIC(19,2) NOT NULL DEFAULT 0,
    selling_price   NUMERIC(19,2) NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_variant_prices_nonneg CHECK (purchase_price >= 0 AND selling_price >= 0)
);
CREATE INDEX idx_variants_product ON product_variants(product_id);

-- ---------- product_prices (price history) ----------
CREATE TABLE product_prices (
    id          BIGSERIAL PRIMARY KEY,
    product_id  BIGINT REFERENCES products(id) ON DELETE CASCADE,
    variant_id  BIGINT REFERENCES product_variants(id) ON DELETE CASCADE,
    price_type  VARCHAR(20) NOT NULL, -- PURCHASE | SELLING
    old_price   NUMERIC(19,2) NOT NULL,
    new_price   NUMERIC(19,2) NOT NULL,
    reason      VARCHAR(255),
    changed_by  VARCHAR(50),
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_price_target CHECK (
        (product_id IS NOT NULL AND variant_id IS NULL) OR
        (product_id IS NULL AND variant_id IS NOT NULL)
    )
);
CREATE INDEX idx_prices_product ON product_prices(product_id);
CREATE INDEX idx_prices_variant ON product_prices(variant_id);

-- ---------- customers ----------
CREATE TABLE customers (
    id              BIGSERIAL PRIMARY KEY,
    customer_code   VARCHAR(50) NOT NULL UNIQUE,
    name            VARCHAR(200) NOT NULL,
    phone           VARCHAR(30),
    address         TEXT,
    member_status   VARCHAR(20) NOT NULL DEFAULT 'REGULAR', -- REGULAR | MEMBER | VIP
    points          INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_customers_name ON customers(name);

-- ---------- suppliers ----------
CREATE TABLE suppliers (
    id              BIGSERIAL PRIMARY KEY,
    supplier_code   VARCHAR(50) NOT NULL UNIQUE,
    name            VARCHAR(200) NOT NULL,
    phone           VARCHAR(30),
    email           VARCHAR(100),
    address         TEXT,
    tax_number      VARCHAR(50),
    payment_term    VARCHAR(50),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- payment_methods ----------
CREATE TABLE payment_methods (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(30) NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

-- ================= seeds =================

INSERT INTO units (code, name) VALUES
    ('PCS','Pcs'),('BOX','Box'),('KG','Kilogram'),('LITER','Liter'),('PACK','Pack')
ON CONFLICT (code) DO NOTHING;

INSERT INTO payment_methods (code, name) VALUES
    ('CASH','Tunai'),('QRIS','QRIS'),('DEBIT','Kartu Debit'),
    ('CREDIT_CARD','Kartu Kredit'),('TRANSFER','Transfer Bank')
ON CONFLICT (code) DO NOTHING;

INSERT INTO customers (customer_code, name, phone, member_status, is_active) VALUES
    ('GENERAL','GENERAL CUSTOMER',NULL,'REGULAR',TRUE)
ON CONFLICT (customer_code) DO NOTHING;

-- new permissions for customer & supplier
INSERT INTO permissions (code, name, group_name) VALUES
    ('customer.view','View customers','customer'),
    ('customer.create','Create customers','customer'),
    ('customer.update','Update customers','customer'),
    ('supplier.view','View suppliers','supplier'),
    ('supplier.create','Create suppliers','supplier'),
    ('supplier.update','Update suppliers','supplier')
ON CONFLICT (code) DO NOTHING;

-- assign to roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE (r.name, p.code) IN (
    ('OWNER','customer.view'),('OWNER','customer.create'),('OWNER','customer.update'),
    ('OWNER','supplier.view'),('OWNER','supplier.create'),('OWNER','supplier.update'),
    ('ADMIN','customer.view'),('ADMIN','customer.create'),('ADMIN','customer.update'),
    ('ADMIN','supplier.view'),('ADMIN','supplier.create'),('ADMIN','supplier.update'),
    ('KASIR','customer.view'),('KASIR','customer.create'),
    ('GUDANG','supplier.view'),('PURCHASING','supplier.view'),
    ('PURCHASING','supplier.create'),('PURCHASING','supplier.update')
)
ON CONFLICT DO NOTHING;
