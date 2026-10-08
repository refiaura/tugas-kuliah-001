-- V7: Purchase (Milestone 6)
-- Purchase order lifecycle: DRAFT → SUBMITTED → APPROVED → ORDERED
--   → PARTIALLY_RECEIVED → RECEIVED, plus CANCELLED.
-- Key rule (PRD §21.2): a purchase ORDER never touches stock; only
-- goods receipts post PURCHASE movements. Purchase returns post
-- PURCHASE_RETURN movements and accumulate a simple supplier credit
-- (full payable cycle deferred).

-- ---------- purchase_orders ----------
CREATE TABLE purchase_orders (
    id              BIGSERIAL PRIMARY KEY,
    doc_no          VARCHAR(50) NOT NULL UNIQUE,   -- PO-YYYYMMDD-000001
    supplier_id     BIGINT NOT NULL REFERENCES suppliers(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    notes           TEXT,
    total_amount    NUMERIC(19,2) NOT NULL DEFAULT 0,  -- computed: sum(qty * unit_price)
    created_by      VARCHAR(50),
    approved_by     VARCHAR(50),
    approved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_po_status CHECK (status IN (
        'DRAFT','SUBMITTED','APPROVED','ORDERED',
        'PARTIALLY_RECEIVED','RECEIVED','CANCELLED'))
);
CREATE INDEX idx_po_no ON purchase_orders(doc_no);
CREATE INDEX idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_po_status ON purchase_orders(status);

CREATE TABLE purchase_order_lines (
    id              BIGSERIAL PRIMARY KEY,
    po_id           BIGINT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id      BIGINT NOT NULL REFERENCES products(id),
    qty             NUMERIC(19,2) NOT NULL,   -- ordered qty
    unit_price      NUMERIC(19,2) NOT NULL DEFAULT 0,
    CONSTRAINT chk_po_line_qty CHECK (qty > 0),
    CONSTRAINT chk_po_line_price CHECK (unit_price >= 0)
);
CREATE INDEX idx_po_lines_po ON purchase_order_lines(po_id);

-- ---------- goods_receipts ----------
-- Partial receipt supported: one PO can have several receipts; per PO line
-- total received may never exceed ordered qty.
CREATE TABLE goods_receipts (
    id              BIGSERIAL PRIMARY KEY,
    doc_no          VARCHAR(50) NOT NULL UNIQUE,   -- GR-YYYYMMDD-000001
    po_id           BIGINT NOT NULL REFERENCES purchase_orders(id),
    notes           TEXT,
    created_by      VARCHAR(50),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_gr_po ON goods_receipts(po_id);

CREATE TABLE goods_receipt_lines (
    id              BIGSERIAL PRIMARY KEY,
    receipt_id      BIGINT NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
    po_line_id      BIGINT NOT NULL REFERENCES purchase_order_lines(id),
    product_id      BIGINT NOT NULL REFERENCES products(id),
    received_qty    NUMERIC(19,2) NOT NULL,   -- actual qty this receipt
    CONSTRAINT chk_gr_line_qty CHECK (received_qty > 0)
);
CREATE INDEX idx_gr_lines_receipt ON goods_receipt_lines(receipt_id);
CREATE INDEX idx_gr_lines_po_line ON goods_receipt_lines(po_line_id);

-- ---------- purchase_returns ----------
-- Return goods to supplier: stock out + supplier credit. Validated against
-- received-minus-returned qty per PO line.
CREATE TABLE purchase_returns (
    id              BIGSERIAL PRIMARY KEY,
    doc_no          VARCHAR(50) NOT NULL UNIQUE,   -- PR-YYYYMMDD-000001
    po_id           BIGINT NOT NULL REFERENCES purchase_orders(id),
    reason          VARCHAR(255) NOT NULL,
    supplier_credit NUMERIC(19,2) NOT NULL DEFAULT 0,  -- computed: sum(qty * unit_price)
    created_by      VARCHAR(50),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pr_po ON purchase_returns(po_id);

CREATE TABLE purchase_return_lines (
    id              BIGSERIAL PRIMARY KEY,
    return_id       BIGINT NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
    po_line_id      BIGINT NOT NULL REFERENCES purchase_order_lines(id),
    product_id      BIGINT NOT NULL REFERENCES products(id),
    qty             NUMERIC(19,2) NOT NULL,   -- returned qty (positive)
    CONSTRAINT chk_pr_line_qty CHECK (qty > 0)
);
CREATE INDEX idx_pr_lines_return ON purchase_return_lines(return_id);
CREATE INDEX idx_pr_lines_po_line ON purchase_return_lines(po_line_id);

-- purchase permissions already seeded in V2
-- (purchase.view, purchase.create, purchase.approve,
--  purchase.receive, purchase.return) — no insert needed here.
