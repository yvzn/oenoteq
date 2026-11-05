-- Producer becomes its own entity, mirroring appellation. Existing wines carry
-- their producer as free text, so backfill the producer table from the distinct
-- names, then rebuild wine (renamed aside, recreated, rows copied across)
-- instead of dropping it outright.
CREATE TABLE producer (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL UNIQUE
);

INSERT INTO producer (name) SELECT DISTINCT producer FROM wine;

-- Renaming wine would normally rewrite consumption's "REFERENCES wine(id)" to
-- wine_old, and DROP TABLE wine_old would then fail the FK check whenever
-- consumption rows exist. foreign_keys=OFF + legacy_alter_table=ON leave that
-- reference untouched; both are restored right after the rename.
PRAGMA foreign_keys = OFF;
PRAGMA legacy_alter_table = ON;
ALTER TABLE wine RENAME TO wine_old;
PRAGMA legacy_alter_table = OFF;
PRAGMA foreign_keys = ON;

CREATE TABLE wine (
	id INTEGER PRIMARY KEY,
	millesime INTEGER,
	appellation_id INTEGER NOT NULL,
	producer_id INTEGER NOT NULL REFERENCES producer(id),
	color TEXT NOT NULL CHECK(color IN ('rouge', 'blanc', 'rose')),
	garde_debut INTEGER NOT NULL,
	garde_fin INTEGER NOT NULL,
	quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (appellation_id) REFERENCES appellation(id)
);

INSERT INTO wine (id, millesime, appellation_id, producer_id, color, garde_debut, garde_fin, quantity, created_at)
SELECT w.id, w.millesime, w.appellation_id, p.id, w.color, w.garde_debut, w.garde_fin, w.quantity, w.created_at
FROM wine_old w
JOIN producer p ON p.name = w.producer;

DROP TABLE wine_old;
