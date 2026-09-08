-- Initial schema: placeholder for future tables
-- Later migrations will add Wine, Appellation, Meal, MealPairing, Consumption
CREATE TABLE IF NOT EXISTS appellation (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS meal (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS wine (
	id INTEGER PRIMARY KEY,
	millesime INTEGER,
	appellation_id INTEGER NOT NULL,
	producer TEXT NOT NULL,
	color TEXT NOT NULL CHECK(color IN ('rouge', 'blanc', 'rose')),
	garde_debut INTEGER NOT NULL,
	garde_fin INTEGER NOT NULL,
	quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (appellation_id) REFERENCES appellation(id)
);

CREATE TABLE IF NOT EXISTS meal_pairing (
	appellation_id INTEGER NOT NULL,
	color TEXT NOT NULL CHECK(color IN ('rouge', 'blanc', 'rose')),
	meal_id INTEGER NOT NULL,
	PRIMARY KEY (appellation_id, color, meal_id),
	FOREIGN KEY (appellation_id) REFERENCES appellation(id),
	FOREIGN KEY (meal_id) REFERENCES meal(id)
);

CREATE TABLE IF NOT EXISTS consumption (
	id INTEGER PRIMARY KEY,
	wine_id INTEGER NOT NULL,
	date DATE NOT NULL,
	rating INTEGER CHECK(rating IS NULL OR (rating >= 1 AND rating <= 5)),
	notes TEXT,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (wine_id) REFERENCES wine(id)
);
