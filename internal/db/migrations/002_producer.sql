-- Producer becomes its own entity, mirroring appellation. No production data
-- needs to survive the cutover, so wine is rebuilt fresh rather than backfilled.
CREATE TABLE producer (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL UNIQUE
);

DROP TABLE wine;

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
