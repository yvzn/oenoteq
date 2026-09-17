package db

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"strings"

	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

type DB struct {
	*sql.DB
}

func Open(path string) (*DB, error) {
	sqlDB, err := sql.Open("sqlite", "file:"+path)
	if err != nil {
		return nil, fmt.Errorf("opening sqlite: %w", err)
	}

	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("ping: %w", err)
	}

	return &DB{sqlDB}, nil
}

func (d *DB) Migrate(ctx context.Context) error {
	if err := d.createVersionTable(ctx); err != nil {
		return err
	}

	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("reading migrations: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}

		if err := d.applyMigration(ctx, entry.Name()); err != nil {
			return err
		}
	}

	return nil
}

func (d *DB) createVersionTable(ctx context.Context) error {
	_, err := d.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS schema_version (
			id INTEGER PRIMARY KEY,
			name TEXT NOT NULL UNIQUE,
			applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)
	return err
}

func (d *DB) applyMigration(ctx context.Context, name string) error {
	var exists int
	if err := d.QueryRowContext(ctx, "SELECT COUNT(*) FROM schema_version WHERE name = ?", name).Scan(&exists); err != nil {
		return err
	}

	if exists > 0 {
		return nil
	}

	content, err := migrationsFS.ReadFile(fmt.Sprintf("migrations/%s", name))
	if err != nil {
		return fmt.Errorf("reading migration %s: %w", name, err)
	}

	if _, err := d.ExecContext(ctx, string(content)); err != nil {
		return fmt.Errorf("applying migration %s: %w", name, err)
	}

	if _, err := d.ExecContext(ctx, "INSERT INTO schema_version (name) VALUES (?)", name); err != nil {
		return fmt.Errorf("recording migration %s: %w", name, err)
	}

	return nil
}

var ErrUniqueConstraint = errors.New("unique constraint violation")

type Appellation struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

func (d *DB) CreateAppellation(ctx context.Context, name string) (*Appellation, error) {
	_, err := d.ExecContext(ctx, "INSERT INTO appellation (name) VALUES (?)", name)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return nil, fmt.Errorf("appellation already exists: %s: %w", name, ErrUniqueConstraint)
		}
		return nil, fmt.Errorf("creating appellation: %w", err)
	}

	var id int
	if err := d.QueryRowContext(ctx, "SELECT last_insert_rowid()").Scan(&id); err != nil {
		return nil, fmt.Errorf("getting last insert id: %w", err)
	}

	return &Appellation{ID: id, Name: name}, nil
}

func (d *DB) ListAppellations(ctx context.Context) ([]Appellation, error) {
	rows, err := d.QueryContext(ctx, "SELECT id, name FROM appellation ORDER BY name")
	if err != nil {
		return nil, fmt.Errorf("querying appellations: %w", err)
	}
	defer rows.Close()

	var appellations []Appellation
	for rows.Next() {
		var a Appellation
		if err := rows.Scan(&a.ID, &a.Name); err != nil {
			return nil, fmt.Errorf("scanning appellation: %w", err)
		}
		appellations = append(appellations, a)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating appellations: %w", err)
	}

	return appellations, nil
}

type Meal struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

func (d *DB) CreateMeal(ctx context.Context, name string) (*Meal, error) {
	_, err := d.ExecContext(ctx, "INSERT INTO meal (name) VALUES (?)", name)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return nil, fmt.Errorf("meal already exists: %s: %w", name, ErrUniqueConstraint)
		}
		return nil, fmt.Errorf("creating meal: %w", err)
	}

	var id int
	if err := d.QueryRowContext(ctx, "SELECT last_insert_rowid()").Scan(&id); err != nil {
		return nil, fmt.Errorf("getting last insert id: %w", err)
	}

	return &Meal{ID: id, Name: name}, nil
}

func (d *DB) ListMeals(ctx context.Context) ([]Meal, error) {
	rows, err := d.QueryContext(ctx, "SELECT id, name FROM meal ORDER BY name")
	if err != nil {
		return nil, fmt.Errorf("querying meals: %w", err)
	}
	defer rows.Close()

	var meals []Meal
	for rows.Next() {
		var m Meal
		if err := rows.Scan(&m.ID, &m.Name); err != nil {
			return nil, fmt.Errorf("scanning meal: %w", err)
		}
		meals = append(meals, m)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating meals: %w", err)
	}

	return meals, nil
}

var (
	ErrInvalidColor        = errors.New("invalid color")
	ErrInvalidQuantity     = errors.New("quantity must be >= 0")
	ErrAppellationNotFound = errors.New("appellation not found")
	ErrWineNotFound        = errors.New("wine not found")
	ErrMealNotFound        = errors.New("meal not found")
)

var validColors = map[string]bool{"rouge": true, "blanc": true, "rose": true}

type Wine struct {
	ID            int    `json:"id"`
	Millesime     *int   `json:"millesime"`
	AppellationID int    `json:"appellation_id"`
	Producer      string `json:"producer"`
	Color         string `json:"color"`
	GardeDebut    int    `json:"garde_debut"`
	GardeFin      int    `json:"garde_fin"`
	Quantity      int    `json:"quantity"`
}

func validateWine(w Wine) error {
	if !validColors[w.Color] {
		return fmt.Errorf("%q: %w", w.Color, ErrInvalidColor)
	}
	if w.Quantity < 0 {
		return fmt.Errorf("%d: %w", w.Quantity, ErrInvalidQuantity)
	}
	return nil
}

func (d *DB) appellationExists(ctx context.Context, id int) error {
	var exists int
	if err := d.QueryRowContext(ctx, "SELECT COUNT(*) FROM appellation WHERE id = ?", id).Scan(&exists); err != nil {
		return fmt.Errorf("checking appellation: %w", err)
	}
	if exists == 0 {
		return fmt.Errorf("appellation id %d: %w", id, ErrAppellationNotFound)
	}
	return nil
}

func (d *DB) CreateWine(ctx context.Context, w Wine) (*Wine, error) {
	if err := validateWine(w); err != nil {
		return nil, err
	}
	if err := d.appellationExists(ctx, w.AppellationID); err != nil {
		return nil, err
	}

	res, err := d.ExecContext(ctx, `
		INSERT INTO wine (millesime, appellation_id, producer, color, garde_debut, garde_fin, quantity)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, w.Millesime, w.AppellationID, w.Producer, w.Color, w.GardeDebut, w.GardeFin, w.Quantity)
	if err != nil {
		return nil, fmt.Errorf("creating wine: %w", err)
	}

	id, err := res.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("getting last insert id: %w", err)
	}

	w.ID = int(id)
	return &w, nil
}

func (d *DB) GetWine(ctx context.Context, id int) (*Wine, error) {
	var w Wine
	err := d.QueryRowContext(ctx, `
		SELECT id, millesime, appellation_id, producer, color, garde_debut, garde_fin, quantity
		FROM wine WHERE id = ?
	`, id).Scan(&w.ID, &w.Millesime, &w.AppellationID, &w.Producer, &w.Color, &w.GardeDebut, &w.GardeFin, &w.Quantity)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("wine id %d: %w", id, ErrWineNotFound)
		}
		return nil, fmt.Errorf("getting wine: %w", err)
	}

	return &w, nil
}

func (d *DB) ListWines(ctx context.Context) ([]Wine, error) {
	rows, err := d.QueryContext(ctx, `
		SELECT id, millesime, appellation_id, producer, color, garde_debut, garde_fin, quantity
		FROM wine ORDER BY id
	`)
	if err != nil {
		return nil, fmt.Errorf("querying wines: %w", err)
	}
	defer rows.Close()

	var wines []Wine
	for rows.Next() {
		var w Wine
		if err := rows.Scan(&w.ID, &w.Millesime, &w.AppellationID, &w.Producer, &w.Color, &w.GardeDebut, &w.GardeFin, &w.Quantity); err != nil {
			return nil, fmt.Errorf("scanning wine: %w", err)
		}
		wines = append(wines, w)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating wines: %w", err)
	}

	return wines, nil
}

type WineDetail struct {
	Wine
	SuggestedMeals []Meal `json:"suggested_meals"`
}

func (d *DB) GetWineDetail(ctx context.Context, id int) (*WineDetail, error) {
	wine, err := d.GetWine(ctx, id)
	if err != nil {
		return nil, err
	}

	meals, err := d.ListMealsForPairing(ctx, wine.AppellationID, wine.Color)
	if err != nil {
		return nil, err
	}
	if meals == nil {
		meals = []Meal{}
	}

	return &WineDetail{Wine: *wine, SuggestedMeals: meals}, nil
}

func (d *DB) mealExists(ctx context.Context, id int) error {
	var exists int
	if err := d.QueryRowContext(ctx, "SELECT COUNT(*) FROM meal WHERE id = ?", id).Scan(&exists); err != nil {
		return fmt.Errorf("checking meal: %w", err)
	}
	if exists == 0 {
		return fmt.Errorf("meal id %d: %w", id, ErrMealNotFound)
	}
	return nil
}

func validateColor(color string) error {
	if !validColors[color] {
		return fmt.Errorf("%q: %w", color, ErrInvalidColor)
	}
	return nil
}

func (d *DB) CreateMealPairing(ctx context.Context, appellationID int, color string, mealID int) error {
	if err := validateColor(color); err != nil {
		return err
	}
	if err := d.appellationExists(ctx, appellationID); err != nil {
		return err
	}
	if err := d.mealExists(ctx, mealID); err != nil {
		return err
	}

	if _, err := d.ExecContext(ctx, `
		INSERT OR IGNORE INTO meal_pairing (appellation_id, color, meal_id) VALUES (?, ?, ?)
	`, appellationID, color, mealID); err != nil {
		return fmt.Errorf("creating meal pairing: %w", err)
	}

	return nil
}

func (d *DB) DeleteMealPairing(ctx context.Context, appellationID int, color string, mealID int) error {
	if err := validateColor(color); err != nil {
		return err
	}
	if err := d.appellationExists(ctx, appellationID); err != nil {
		return err
	}
	if err := d.mealExists(ctx, mealID); err != nil {
		return err
	}

	if _, err := d.ExecContext(ctx, `
		DELETE FROM meal_pairing WHERE appellation_id = ? AND color = ? AND meal_id = ?
	`, appellationID, color, mealID); err != nil {
		return fmt.Errorf("deleting meal pairing: %w", err)
	}

	return nil
}

func (d *DB) ListMealsForPairing(ctx context.Context, appellationID int, color string) ([]Meal, error) {
	if err := validateColor(color); err != nil {
		return nil, err
	}

	rows, err := d.QueryContext(ctx, `
		SELECT meal.id, meal.name
		FROM meal_pairing
		JOIN meal ON meal.id = meal_pairing.meal_id
		WHERE meal_pairing.appellation_id = ? AND meal_pairing.color = ?
		ORDER BY meal.name
	`, appellationID, color)
	if err != nil {
		return nil, fmt.Errorf("querying meal pairing: %w", err)
	}
	defer rows.Close()

	var meals []Meal
	for rows.Next() {
		var m Meal
		if err := rows.Scan(&m.ID, &m.Name); err != nil {
			return nil, fmt.Errorf("scanning meal: %w", err)
		}
		meals = append(meals, m)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating meal pairing: %w", err)
	}

	return meals, nil
}

func (d *DB) UpdateWine(ctx context.Context, id int, w Wine) (*Wine, error) {
	if err := validateWine(w); err != nil {
		return nil, err
	}
	if err := d.appellationExists(ctx, w.AppellationID); err != nil {
		return nil, err
	}

	res, err := d.ExecContext(ctx, `
		UPDATE wine
		SET millesime = ?, appellation_id = ?, producer = ?, color = ?, garde_debut = ?, garde_fin = ?, quantity = ?
		WHERE id = ?
	`, w.Millesime, w.AppellationID, w.Producer, w.Color, w.GardeDebut, w.GardeFin, w.Quantity, id)
	if err != nil {
		return nil, fmt.Errorf("updating wine: %w", err)
	}

	affected, err := res.RowsAffected()
	if err != nil {
		return nil, fmt.Errorf("getting rows affected: %w", err)
	}
	if affected == 0 {
		return nil, fmt.Errorf("wine id %d: %w", id, ErrWineNotFound)
	}

	w.ID = id
	return &w, nil
}
