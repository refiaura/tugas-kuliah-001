-- V6: Inventory documents (Milestone 5)
-- stock_opname_docs (+lines), stock_adjustments, stock_transfers, stock_receipts.
-- Every document posts to stock_movements (ledger) and inventory_balances.
-- Location is a simple text column (no full multi-warehouse model).

-- ---------- stock_opname_docs ----------
CREATE TABLE stock_opname_docs (
    id              BIGSERIAL PRIMARY KEY,
    doc_no          VARCHAR(50) NOT NULL UNIQUE,
    status          VARCHAR(20) NOT NULL DEFAULT 'COMPLETED', -- DRAFT | COMPLETED
    location        VARCHAR(100),
    notes           TEXT,
    created_by      VARCHAR(50),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_opname_docs_no ON stock_opname_docs(doc_no);

CREATE TABLE stock_opname_lines (
    id              BIGSERIAL PRIMARY KEY,
    opname_id       BIGINT NOT NULL REFERENCES stock_opname_docs(id) ON DELETE CASCADE,
    product_id      BIGINT NOT NULL REFERENCES products(id),
    expected_qty    NUMERIC(19,2) NOT NULL,   -- balance snapshot at submit
    counted_qty     NUMERIC(19,2) NOT NULL,   -- physical count input
    difference_qty  NUMERIC(19,2) NOT NULL    -- counted - expected
);
CREATE INDEX idx_opname_lines_doc ON stock_opname_lines(opname_id);

-- ---------- stock_adjustments ----------
-- Manual correction with mandatory reason (PRD §19).
CREATE TABLE stock_adjustments (
    id              BIGSERIAL PRIMARY KEY,
    doc_no          VARCHAR(50) NOT NULL UNIQUE,
    product_id      BIGINT NOT NULL REFERENCES products(id),
    qty_change      NUMERIC(19,2) NOT NULL,  -- signed: + in, - out
    reason          VARCHAR(255) NOT NULL,
    created_by      VARCHAR(50),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_adjustment_qty CHECK (qty_change <> 0)
);
CREATE INDEX idx_adjustments_product ON stock_adjustments(product_id);

-- ---------- stock_transfers ----------
-- Atomic out/in between simple locations (single-step, COMPLETED).
CREATE TABLE stock_transfers (
    id              BIGSERIAL PRIMARY KEY,
    doc_no          VARCHAR(50) NOT NULL UNIQUE,
    product_id      BIGINT NOT NULL REFERENCES products(id),
    qty             NUMERIC(19,2) NOT NULL,
    from_location   VARCHAR(100) NOT NULL,
    to_location     VARCHAR(100) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    notes           TEXT,
    created_by      VARCHAR(50),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_transfer_qty CHECK (qty > 0),
    CONSTRAINT chk_transfer_locations CHECK (from_location <> to_location)
);
CREATE INDEX idx_transfers_product ON stock_transfers(product_id);

-- ---------- stock_receipts ----------
-- Goods received (stock in) with optional supplier reference.
CREATE TABLE stock_receipts (
    id              BIGSERIAL PRIMARY KEY,
    doc_no          VARCHAR(50) NOT NULL UNIQUE,
    product_id      BIGINT NOT NULL REFERENCES products(id),
    qty             NUMERIC(19,2) NOT NULL,
    location        VARCHAR(100),
    supplier_ref    VARCHAR(100),
    notes           TEXT,
    created_by      VARCHAR(50),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_receipt_qty CHECK (qty > 0)
);
CREATE INDEX idx_receipts_product ON stock_receipts(product_id);

-- ---------- ledger enrichment ----------
-- Location per movement (PRD §17.1: every movement carries warehouse/store).
ALTER TABLE stock_movements ADD COLUMN location VARCHAR(100);

-- stock permissions already seeded in V2 (stock.view, stock.adjustment,
-- stock.opname, stock.transfer, stock.receive) — no insert needed here.
