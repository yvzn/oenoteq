-- Wine.quantity becomes a materialized total kept in sync by delta events
-- (ADR-0006) rather than an absolute value the client can set directly.
-- Consumption already decrements by one; this adds the manual correction
-- side. quantity_adjustment records manual corrections only — Consumption
-- rows remain the sole record of consumption-driven changes, so there's no
-- duplicated ledger entry for that path.
CREATE TABLE quantity_adjustment (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	client_id TEXT,
	wine_id INTEGER NOT NULL,
	delta INTEGER NOT NULL,
	reason TEXT NOT NULL DEFAULT 'manual',
	created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (wine_id) REFERENCES wine(id)
);

CREATE UNIQUE INDEX idx_quantity_adjustment_client_id ON quantity_adjustment(client_id);
