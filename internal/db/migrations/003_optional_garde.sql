-- Garde bounds become independently optional. SQLite has no ALTER COLUMN to
-- drop NOT NULL, so rebuild the table and copy existing rows across instead
-- of dropping wine outright.
ALTER TABLE wine RENAME TO wine_old;

CREATE TABLE wine (
	id INTEGER PRIMARY KEY,
	millesime INTEGER,
	appellation_id INTEGER NOT NULL,
	producer_id INTEGER NOT NULL REFERENCES producer(id),
	color TEXT NOT NULL CHECK(color IN ('rouge', 'blanc', 'rose')),
	garde_debut INTEGER,
	garde_fin INTEGER,
	quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (appellation_id) REFERENCES appellation(id)
);

INSERT INTO wine (id, millesime, appellation_id, producer_id, color, garde_debut, garde_fin, quantity, created_at)
SELECT id, millesime, appellation_id, producer_id, color, garde_debut, garde_fin, quantity, created_at
FROM wine_old;

DROP TABLE wine_old;
