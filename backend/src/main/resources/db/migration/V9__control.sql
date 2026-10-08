-- V9: Control (Milestone 7)
-- approvals workflow (generic), audit log append-only,
-- sale returns, damaged stock bucket, void fields on sales,
-- returned_qty on sale_items, REFUND cash movement type.

-- ---------- approvals (generic) ----------
CREATE TABLE approvals (
    id              BIGSERIAL PRIMARY KEY,
    subject_type    VARCHAR(30) NOT NULL, -- SALE_VOID | SALE_RETURN | SHIFT_VARIANCE
    subject_id      BIGINT      NOT NULL,
    requested_by    VARCHAR(50) NOT NULL,
    reason          TEXT        NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING | APPROVED | REJECTED
    decided_by      VARCHAR(50),
    decided_at      TIMESTAMPTZ,
    decision_note   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_approval_subject CHECK (subject_type IN ('SALE_VOID','SALE_RETURN','SHIFT_VARIANCE')),
    CONSTRAINT chk_approval_status CHECK (status IN ('PENDING','APPROVED','REJECTED'))
);
CREATE INDEX idx_approvals_status ON approvals(status);
CREATE INDEX idx_approvals_subject ON approvals(subject_type, subject_id);
-- one pending request per subject at a time
CREATE UNIQUE INDEX uq_approvals_pending ON approvals(subject_type, subject_id)
    WHERE status = 'PENDING';

-- ---------- audit log (append-only) ----------
CREATE TABLE audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    actor           VARCHAR(50) NOT NULL,
    action          VARCHAR(40) NOT NULL, -- e.g. VOID_REQUESTED, PRICE_CHANGE, USER_LOGIN
    entity_type     VARCHAR(40) NOT NULL,
    entity_id       VARCHAR(100) NOT NULL,
    old_value       JSONB,
    new_value       JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- ---------- sale returns ----------
CREATE TABLE sale_returns (
    id              BIGSERIAL PRIMARY KEY,
    return_no       VARCHAR(50) NOT NULL UNIQUE,
    sale_id         BIGINT NOT NULL REFERENCES sales(id),
    approval_id     BIGINT REFERENCES approvals(id),
    reason          TEXT NOT NULL,
    refund_amount   NUMERIC(19,2) NOT NULL DEFAULT 0,
    shift_id        BIGINT REFERENCES cashier_shifts(id), -- shift where refund was posted
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING | COMPLETED | REJECTED
    created_by      VARCHAR(50),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_sale_return_status CHECK (status IN ('PENDING','COMPLETED','REJECTED')),
    CONSTRAINT chk_sale_return_amount CHECK (refund_amount >= 0)
);
CREATE INDEX idx_sale_returns_sale ON sale_returns(sale_id);
CREATE INDEX idx_sale_returns_status ON sale_returns(status);

CREATE TABLE sale_return_lines (
    id              BIGSERIAL PRIMARY KEY,
    sale_return_id  BIGINT NOT NULL REFERENCES sale_returns(id) ON DELETE CASCADE,
    sale_item_id    BIGINT NOT NULL REFERENCES sale_items(id),
    product_id      BIGINT NOT NULL REFERENCES products(id),
    qty             NUMERIC(19,2) NOT NULL,
    unit_price      NUMERIC(19,2) NOT NULL,
    line_discount   NUMERIC(19,2) NOT NULL DEFAULT 0,
    condition       VARCHAR(20) NOT NULL, -- SELLABLE | DAMAGED
    CONSTRAINT chk_return_line_qty CHECK (qty > 0),
    CONSTRAINT chk_return_condition CHECK (condition IN ('SELLABLE','DAMAGED'))
);
CREATE INDEX idx_return_lines_return ON sale_return_lines(sale_return_id);

-- ---------- damaged stock bucket ----------
ALTER TABLE inventory_balances
    ADD COLUMN IF NOT EXISTS damaged_qty NUMERIC(19,2) NOT NULL DEFAULT 0;

-- ---------- returned qty tracking on sale items ----------
ALTER TABLE sale_items
    ADD COLUMN IF NOT EXISTS returned_qty NUMERIC(19,2) NOT NULL DEFAULT 0;

-- ---------- void fields on sales ----------
ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS voided_by VARCHAR(50),
    ADD COLUMN IF NOT EXISTS void_reason TEXT;

-- ---------- REFUND cash movement type ----------
ALTER TABLE cash_movements DROP CONSTRAINT IF EXISTS chk_movement_type;
ALTER TABLE cash_movements
    ADD CONSTRAINT chk_movement_type CHECK (type IN ('IN','OUT','REFUND'));
