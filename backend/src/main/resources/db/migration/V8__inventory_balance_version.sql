-- V8: add optimistic-locking version column to inventory_balances
-- (entity InventoryBalance.@Version was added after V4 created the table).
ALTER TABLE inventory_balances ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
