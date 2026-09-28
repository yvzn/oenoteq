-- Idempotent creates via client-generated client_id, plus a server-managed
-- updated_at for Last-Write-Wins reconciliation (ADR-0006). Additive: SQLite
-- ALTER TABLE ADD COLUMN handles this without rebuilding any table. SQLite
-- rejects CURRENT_TIMESTAMP as an ADD COLUMN default, so updated_at is added
-- nullable and backfilled once here; every INSERT/UPDATE going forward sets
-- it explicitly. client_id stays nullable too — SQLite treats each NULL as
-- distinct for UNIQUE indexes, so a plain unique index (no WHERE needed)
-- still allows any number of client_id-less rows.
ALTER TABLE wine ADD COLUMN client_id TEXT;
ALTER TABLE wine ADD COLUMN updated_at TIMESTAMP;
UPDATE wine SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;
CREATE UNIQUE INDEX idx_wine_client_id ON wine(client_id);

ALTER TABLE producer ADD COLUMN client_id TEXT;
ALTER TABLE producer ADD COLUMN updated_at TIMESTAMP;
UPDATE producer SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;
CREATE UNIQUE INDEX idx_producer_client_id ON producer(client_id);

ALTER TABLE appellation ADD COLUMN client_id TEXT;
ALTER TABLE appellation ADD COLUMN updated_at TIMESTAMP;
UPDATE appellation SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;
CREATE UNIQUE INDEX idx_appellation_client_id ON appellation(client_id);

ALTER TABLE meal ADD COLUMN client_id TEXT;
ALTER TABLE meal ADD COLUMN updated_at TIMESTAMP;
UPDATE meal SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;
CREATE UNIQUE INDEX idx_meal_client_id ON meal(client_id);

ALTER TABLE consumption ADD COLUMN client_id TEXT;
ALTER TABLE consumption ADD COLUMN updated_at TIMESTAMP;
UPDATE consumption SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;
CREATE UNIQUE INDEX idx_consumption_client_id ON consumption(client_id);
