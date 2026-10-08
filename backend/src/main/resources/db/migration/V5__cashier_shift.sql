-- V5: Cashier Shift (Milestone 4)
-- cashier_shifts (1 OPEN per cashier), cash_movements (in/out + reason).

CREATE TABLE cashier_shifts (
    id              BIGSERIAL PRIMARY KEY,
    cashier_id      BIGINT NOT NULL REFERENCES users(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'OPEN', -- OPEN | CLOSED
    opening_cash    NUMERIC(19,2) NOT NULL DEFAULT 0,
    expected_cash   NUMERIC(19,2),
    actual_cash     NUMERIC(19,2),
    variance        NUMERIC(19,2),
    variance_approved_by VARCHAR(50),
    notes           TEXT,
    opened_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at       TIMESTAMPTZ,
    CONSTRAINT chk_shift_cash CHECK (opening_cash >= 0)
);
-- one OPEN shift per cashier (partial unique index)
CREATE UNIQUE INDEX uq_open_shift_per_cashier
    ON cashier_shifts(cashier_id) WHERE status = 'OPEN';

CREATE TABLE cash_movements (
    id              BIGSERIAL PRIMARY KEY,
    shift_id        BIGINT NOT NULL REFERENCES cashier_shifts(id) ON DELETE CASCADE,
    type            VARCHAR(10) NOT NULL, -- IN | OUT
    amount          NUMERIC(19,2) NOT NULL,
    reason          VARCHAR(255) NOT NULL,
    reference_no    VARCHAR(100),
    created_by      VARCHAR(50),
    approved_by     VARCHAR(50),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_movement_amount CHECK (amount > 0),
    CONSTRAINT chk_movement_type CHECK (type IN ('IN','OUT'))
);
CREATE INDEX idx_movements_shift ON cash_movements(shift_id);

-- link sales to shift (nullable for backward compat with M3 data)
ALTER TABLE sales ADD COLUMN shift_id BIGINT REFERENCES cashier_shifts(id);
CREATE INDEX idx_sales_shift ON sales(shift_id);

-- shift permissions
INSERT INTO permissions (code, name, group_name) VALUES
    ('shift.open','Open shift','shift'),
    ('shift.close','Close shift','shift'),
    ('cash.in','Cash in','cash'),
    ('cash.out','Cash out','cash'),
    ('cash.reconcile','Reconcile cash','cash')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE (r.name, p.code) IN (
    ('OWNER','shift.open'),('OWNER','shift.close'),('OWNER','cash.in'),('OWNER','cash.out'),('OWNER','cash.reconcile'),
    ('ADMIN','shift.open'),('ADMIN','shift.close'),('ADMIN','cash.in'),('ADMIN','cash.out'),('ADMIN','cash.reconcile'),
    ('KASIR','shift.open'),('KASIR','shift.close'),('KASIR','cash.in'),('KASIR','cash.out'),
    ('MANAJER','cash.reconcile')
)
ON CONFLICT DO NOTHING;
