-- Migration 003 renamed wine -> wine_old before rebuilding it (to drop a
-- NOT NULL constraint). SQLite's default legacy_alter_table=OFF makes a
-- table rename follow into every other table's FOREIGN KEY clauses that
-- point at it, so consumption's "REFERENCES wine(id)" silently became
-- "REFERENCES wine_old(id)" — then wine_old was dropped, leaving it
-- pointing at a table that no longer exists. Harmless while foreign_keys
-- enforcement was off (the default); now that it's on, rebuild consumption
-- with the FK pointing at the right table.
ALTER TABLE consumption RENAME TO consumption_old;

CREATE TABLE consumption (
	id INTEGER PRIMARY KEY,
	wine_id INTEGER NOT NULL,
	date DATE NOT NULL,
	rating INTEGER CHECK(rating IS NULL OR (rating >= 1 AND rating <= 5)),
	notes TEXT,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	client_id TEXT,
	updated_at TIMESTAMP,
	FOREIGN KEY (wine_id) REFERENCES wine(id)
);

INSERT INTO consumption (id, wine_id, date, rating, notes, created_at, client_id, updated_at)
SELECT id, wine_id, date, rating, notes, created_at, client_id, updated_at
FROM consumption_old;

DROP TABLE consumption_old;

CREATE UNIQUE INDEX idx_consumption_client_id ON consumption(client_id);
