-- V10: in-app notifications (PRD §27) + notification.view permission.
--
-- user_id NULL = broadcast (visible to every user that has notification.view).
-- Types: LOW_STOCK, OUT_OF_STOCK, PENDING_APPROVAL, SHIFT_VARIANCE,
--        SHIFT_OPEN, PO_PENDING.

CREATE TABLE notifications (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT REFERENCES users(id),
    type        VARCHAR(50)  NOT NULL,
    title       VARCHAR(200) NOT NULL,
    message     TEXT,
    entity_type VARCHAR(50),
    entity_id   BIGINT,
    is_read     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_read_created
    ON notifications (user_id, is_read, created_at DESC);

-- ---------- permission ----------
INSERT INTO permissions (code, name, group_name) VALUES
    ('notification.view', 'View notifications', 'notification')
ON CONFLICT (code) DO NOTHING;

-- ---------- role grants ----------
-- KASIR gets it too: cashiers must see their own shift/stock alerts.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name IN ('OWNER', 'ADMIN', 'SUPERVISOR', 'KASIR')
  AND p.code = 'notification.view'
ON CONFLICT DO NOTHING;
