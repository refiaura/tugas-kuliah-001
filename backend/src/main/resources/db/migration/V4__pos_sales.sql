-- V4: POS / Sales (Milestone 3)
-- document_counters, sales, sale_items, sale_payments,
-- stock_movements (ledger), inventory_balances (cached).

-- ---------- document_counters ----------
-- Concurrent-safe invoice numbering: INV-20261008-000001
CREATE TABLE document_counters (
    doc_type    VARCHAR(20) NOT NULL,
    doc_date    DATE NOT NULL,
    last_number INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (doc_type, doc_date)
);

-- ---------- sales ----------
CREATE TABLE sales (
    id              BIGSERIAL PRIMARY KEY,
    invoice_no      VARCHAR(50) NOT NULL UNIQUE,
    customer_id     BIGINT REFERENCES customers(id),
    cashier_id      BIGINT REFERENCES users(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
                    -- DRAFT | HELD | COMPLETED | CANCELLED
    subtotal        NUMERIC(19,2) NOT NULL DEFAULT 0,
    discount_total  NUMERIC(19,2) NOT NULL DEFAULT 0,
    tax_total       NUMERIC(19,2) NOT NULL DEFAULT 0,
    grand_total     NUMERIC(19,2) NOT NULL DEFAULT 0,
    paid_total      NUMERIC(19,2) NOT NULL DEFAULT 0,
    change_amount   NUMERIC(19,2) NOT NULL DEFAULT 0,
    notes           TEXT,
    idempotency_key VARCHAR(100) UNIQUE,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_sale_totals CHECK (grand_total >= 0 AND paid_total >= 0)
);
CREATE INDEX idx_sales_invoice ON sales(invoice_no);
CREATE INDEX idx_sales_status ON sales(status);
CREATE INDEX idx_sales_created ON sales(created_at);

-- ---------- sale_items (price snapshot) ----------
CREATE TABLE sale_items (
    id          BIGSERIAL PRIMARY KEY,
    sale_id     BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id  BIGINT NOT NULL REFERENCES products(id),
    variant_id  BIGINT REFERENCES product_variants(id),
    sku         VARCHAR(50) NOT NULL,
    name        VARCHAR(200) NOT NULL,
    qty         NUMERIC(19,2) NOT NULL,
    unit_price  NUMERIC(19,2) NOT NULL,  -- snapshot at sale time
    discount    NUMERIC(19,2) NOT NULL DEFAULT 0,
    subtotal    NUMERIC(19,2) NOT NULL,
    CONSTRAINT chk_item_qty CHECK (qty > 0),
    CONSTRAINT chk_item_price CHECK (unit_price >= 0)
);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);

-- ---------- sale_payments ----------
CREATE TABLE sale_payments (
    id                  BIGSERIAL PRIMARY KEY,
    sale_id             BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    payment_method_id   BIGINT NOT NULL REFERENCES payment_methods(id),
    amount              NUMERIC(19,2) NOT NULL,
    reference_no        VARCHAR(100),
    CONSTRAINT chk_payment_amount CHECK (amount > 0)
);
CREATE INDEX idx_sale_payments_sale ON sale_payments(sale_id);

-- ---------- stock_movements (ledger) ----------
CREATE TABLE stock_movements (
    id              BIGSERIAL PRIMARY KEY,
    product_id      BIGINT NOT NULL REFERENCES products(id),
    variant_id      BIGINT REFERENCES product_variants(id),
    qty_change      NUMERIC(19,2) NOT NULL,  -- negative for SALE
    movement_type   VARCHAR(20) NOT NULL,    -- SALE | PURCHASE | RETURN | ADJUSTMENT | ...
    reference_type  VARCHAR(20) NOT NULL,    -- SALE | PURCHASE | ...
    reference_id    BIGINT NOT NULL,
    created_by      VARCHAR(50),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_movements_product ON stock_movements(product_id);
CREATE INDEX idx_movements_ref ON stock_movements(reference_type, reference_id);

-- ---------- inventory_balances (cached, derived from ledger) ----------
CREATE TABLE inventory_balances (
    product_id  BIGINT PRIMARY KEY REFERENCES products(id),
    qty         NUMERIC(19,2) NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- sales permissions
INSERT INTO permissions (code, name, group_name) VALUES
    ('sales.view','View sales','sales'),
    ('sales.create','Create sales','sales'),
    ('sales.void','Void sales','sales')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE (r.name, p.code) IN (
    ('OWNER','sales.view'),('OWNER','sales.create'),('OWNER','sales.void'),
    ('ADMIN','sales.view'),('ADMIN','sales.create'),('ADMIN','sales.void'),
    ('KASIR','sales.view'),('KASIR','sales.create'),
    ('MANAJER','sales.view'),('MANAJER','sales.void')
)
ON CONFLICT DO NOTHING;
