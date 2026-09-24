package db

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"strings"
	"time"

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

func (d *DB) UpdateAppellation(ctx context.Context, id int, name string) (*Appellation, error) {
	res, err := d.ExecContext(ctx, "UPDATE appellation SET name = ? WHERE id = ?", name, id)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return nil, fmt.Errorf("appellation already exists: %s: %w", name, ErrUniqueConstraint)
		}
		return nil, fmt.Errorf("updating appellation: %w", err)
	}

	affected, err := res.RowsAffected()
	if err != nil {
		return nil, fmt.Errorf("getting rows affected: %w", err)
	}
	if affected == 0 {
		return nil, fmt.Errorf("appellation id %d: %w", id, ErrAppellationNotFound)
	}

	return &Appellation{ID: id, Name: name}, nil
}

// DeleteAppellation explicitly checks for referencing wine and meal_pairing
// rows before deleting, since FK enforcement is off repo-wide and there's no
// ON DELETE behavior to lean on.
func (d *DB) DeleteAppellation(ctx context.Context, id int) error {
	if err := d.appellationExists(ctx, id); err != nil {
		return err
	}

	var inUse int
	if err := d.QueryRowContext(ctx, "SELECT COUNT(*) FROM wine WHERE appellation_id = ?", id).Scan(&inUse); err != nil {
		return fmt.Errorf("checking wine references: %w", err)
	}
	if inUse > 0 {
		return fmt.Errorf("appellation id %d: %w", id, ErrAppellationInUse)
	}

	if err := d.QueryRowContext(ctx, "SELECT COUNT(*) FROM meal_pairing WHERE appellation_id = ?", id).Scan(&inUse); err != nil {
		return fmt.Errorf("checking meal pairing references: %w", err)
	}
	if inUse > 0 {
		return fmt.Errorf("appellation id %d: %w", id, ErrAppellationInUse)
	}

	if _, err := d.ExecContext(ctx, "DELETE FROM appellation WHERE id = ?", id); err != nil {
		return fmt.Errorf("deleting appellation: %w", err)
	}

	return nil
}

type Producer struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

func (d *DB) CreateProducer(ctx context.Context, name string) (*Producer, error) {
	_, err := d.ExecContext(ctx, "INSERT INTO producer (name) VALUES (?)", name)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return nil, fmt.Errorf("producer already exists: %s: %w", name, ErrUniqueConstraint)
		}
		return nil, fmt.Errorf("creating producer: %w", err)
	}

	var id int
	if err := d.QueryRowContext(ctx, "SELECT last_insert_rowid()").Scan(&id); err != nil {
		return nil, fmt.Errorf("getting last insert id: %w", err)
	}

	return &Producer{ID: id, Name: name}, nil
}

func (d *DB) ListProducers(ctx context.Context) ([]Producer, error) {
	rows, err := d.QueryContext(ctx, "SELECT id, name FROM producer ORDER BY name")
	if err != nil {
		return nil, fmt.Errorf("querying producers: %w", err)
	}
	defer rows.Close()

	var producers []Producer
	for rows.Next() {
		var p Producer
		if err := rows.Scan(&p.ID, &p.Name); err != nil {
			return nil, fmt.Errorf("scanning producer: %w", err)
		}
		producers = append(producers, p)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating producers: %w", err)
	}

	return producers, nil
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

func (d *DB) UpdateMeal(ctx context.Context, id int, name string) (*Meal, error) {
	res, err := d.ExecContext(ctx, "UPDATE meal SET name = ? WHERE id = ?", name, id)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return nil, fmt.Errorf("meal already exists: %s: %w", name, ErrUniqueConstraint)
		}
		return nil, fmt.Errorf("updating meal: %w", err)
	}

	affected, err := res.RowsAffected()
	if err != nil {
		return nil, fmt.Errorf("getting rows affected: %w", err)
	}
	if affected == 0 {
		return nil, fmt.Errorf("meal id %d: %w", id, ErrMealNotFound)
	}

	return &Meal{ID: id, Name: name}, nil
}

// DeleteMeal explicitly checks for referencing meal_pairing rows before
// deleting, since FK enforcement is off repo-wide and there's no ON DELETE
// behavior to lean on.
func (d *DB) DeleteMeal(ctx context.Context, id int) error {
	if err := d.mealExists(ctx, id); err != nil {
		return err
	}

	var inUse int
	if err := d.QueryRowContext(ctx, "SELECT COUNT(*) FROM meal_pairing WHERE meal_id = ?", id).Scan(&inUse); err != nil {
		return fmt.Errorf("checking meal pairing references: %w", err)
	}
	if inUse > 0 {
		return fmt.Errorf("meal id %d: %w", id, ErrMealInUse)
	}

	if _, err := d.ExecContext(ctx, "DELETE FROM meal WHERE id = ?", id); err != nil {
		return fmt.Errorf("deleting meal: %w", err)
	}

	return nil
}

var (
	ErrInvalidColor        = errors.New("invalid color")
	ErrInvalidQuantity     = errors.New("quantity must be >= 0")
	ErrAppellationNotFound = errors.New("appellation not found")
	ErrProducerNotFound    = errors.New("producer not found")
	ErrWineNotFound        = errors.New("wine not found")
	ErrMealNotFound        = errors.New("meal not found")
	ErrMealInUse           = errors.New("meal is in use")
	ErrAppellationInUse    = errors.New("appellation is in use")
	ErrDateRequired        = errors.New("date is required")
	ErrInvalidDate         = errors.New("date must be in YYYY-MM-DD format")
	ErrInvalidRating       = errors.New("rating must be between 1 and 5")
	ErrQuantityZero        = errors.New("wine quantity is already 0")
)

var validColors = map[string]bool{"rouge": true, "blanc": true, "rose": true}

type Wine struct {
	ID            int      `json:"id"`
	Millesime     *int     `json:"millesime"`
	AppellationID int      `json:"appellation_id"`
	ProducerID    int      `json:"producer_id"`
	Producer      Producer `json:"producer"`
	Color         string   `json:"color"`
	GardeDebut    int      `json:"garde_debut"`
	GardeFin      int      `json:"garde_fin"`
	Quantity      int      `json:"quantity"`
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

func (d *DB) producerByID(ctx context.Context, id int) (Producer, error) {
	var p Producer
	err := d.QueryRowContext(ctx, "SELECT id, name FROM producer WHERE id = ?", id).Scan(&p.ID, &p.Name)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Producer{}, fmt.Errorf("producer id %d: %w", id, ErrProducerNotFound)
		}
		return Producer{}, fmt.Errorf("getting producer: %w", err)
	}
	return p, nil
}

func (d *DB) CreateWine(ctx context.Context, w Wine) (*Wine, error) {
	if err := validateWine(w); err != nil {
		return nil, err
	}
	if err := d.appellationExists(ctx, w.AppellationID); err != nil {
		return nil, err
	}
	producer, err := d.producerByID(ctx, w.ProducerID)
	if err != nil {
		return nil, err
	}

	res, err := d.ExecContext(ctx, `
		INSERT INTO wine (millesime, appellation_id, producer_id, color, garde_debut, garde_fin, quantity)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, w.Millesime, w.AppellationID, w.ProducerID, w.Color, w.GardeDebut, w.GardeFin, w.Quantity)
	if err != nil {
		return nil, fmt.Errorf("creating wine: %w", err)
	}

	id, err := res.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("getting last insert id: %w", err)
	}

	w.ID = int(id)
	w.Producer = producer
	return &w, nil
}

func (d *DB) GetWine(ctx context.Context, id int) (*Wine, error) {
	var w Wine
	err := d.QueryRowContext(ctx, `
		SELECT wine.id, wine.millesime, wine.appellation_id, wine.producer_id, producer.name, wine.color, wine.garde_debut, wine.garde_fin, wine.quantity
		FROM wine JOIN producer ON producer.id = wine.producer_id
		WHERE wine.id = ?
	`, id).Scan(&w.ID, &w.Millesime, &w.AppellationID, &w.ProducerID, &w.Producer.Name, &w.Color, &w.GardeDebut, &w.GardeFin, &w.Quantity)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("wine id %d: %w", id, ErrWineNotFound)
		}
		return nil, fmt.Errorf("getting wine: %w", err)
	}
	w.Producer.ID = w.ProducerID

	return &w, nil
}

func (d *DB) ListWines(ctx context.Context) ([]Wine, error) {
	rows, err := d.QueryContext(ctx, `
		SELECT wine.id, wine.millesime, wine.appellation_id, wine.producer_id, producer.name, wine.color, wine.garde_debut, wine.garde_fin, wine.quantity
		FROM wine JOIN producer ON producer.id = wine.producer_id
		ORDER BY wine.id
	`)
	if err != nil {
		return nil, fmt.Errorf("querying wines: %w", err)
	}
	defer rows.Close()

	var wines []Wine
	for rows.Next() {
		var w Wine
		if err := rows.Scan(&w.ID, &w.Millesime, &w.AppellationID, &w.ProducerID, &w.Producer.Name, &w.Color, &w.GardeDebut, &w.GardeFin, &w.Quantity); err != nil {
			return nil, fmt.Errorf("scanning wine: %w", err)
		}
		w.Producer.ID = w.ProducerID
		wines = append(wines, w)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating wines: %w", err)
	}

	return wines, nil
}

type WineDetail struct {
	Wine
	SuggestedMeals     []Meal        `json:"suggested_meals"`
	ConsumptionHistory []Consumption `json:"consumption_history"`
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

	consumptions, err := d.ListConsumptions(ctx, id)
	if err != nil {
		return nil, err
	}
	if consumptions == nil {
		consumptions = []Consumption{}
	}

	return &WineDetail{Wine: *wine, SuggestedMeals: meals, ConsumptionHistory: consumptions}, nil
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
	producer, err := d.producerByID(ctx, w.ProducerID)
	if err != nil {
		return nil, err
	}

	res, err := d.ExecContext(ctx, `
		UPDATE wine
		SET millesime = ?, appellation_id = ?, producer_id = ?, color = ?, garde_debut = ?, garde_fin = ?, quantity = ?
		WHERE id = ?
	`, w.Millesime, w.AppellationID, w.ProducerID, w.Color, w.GardeDebut, w.GardeFin, w.Quantity, id)
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
	w.Producer = producer
	return &w, nil
}

type Consumption struct {
	ID     int     `json:"id"`
	WineID int     `json:"wine_id"`
	Date   string  `json:"date"`
	Rating *int    `json:"rating"`
	Notes  *string `json:"notes"`
}

func validateConsumption(c Consumption) error {
	if c.Date == "" {
		return ErrDateRequired
	}
	if _, err := time.Parse("2006-01-02", c.Date); err != nil {
		return fmt.Errorf("%q: %w", c.Date, ErrInvalidDate)
	}
	if c.Rating != nil && (*c.Rating < 1 || *c.Rating > 5) {
		return fmt.Errorf("%d: %w", *c.Rating, ErrInvalidRating)
	}
	return nil
}

func (d *DB) CreateConsumption(ctx context.Context, c Consumption) (*Consumption, error) {
	if err := validateConsumption(c); err != nil {
		return nil, err
	}

	tx, err := d.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	var quantity int
	if err := tx.QueryRowContext(ctx, "SELECT quantity FROM wine WHERE id = ?", c.WineID).Scan(&quantity); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("wine id %d: %w", c.WineID, ErrWineNotFound)
		}
		return nil, fmt.Errorf("checking wine quantity: %w", err)
	}
	if quantity == 0 {
		return nil, fmt.Errorf("wine id %d: %w", c.WineID, ErrQuantityZero)
	}

	res, err := tx.ExecContext(ctx, `
		INSERT INTO consumption (wine_id, date, rating, notes) VALUES (?, ?, ?, ?)
	`, c.WineID, c.Date, c.Rating, c.Notes)
	if err != nil {
		return nil, fmt.Errorf("creating consumption: %w", err)
	}

	if _, err := tx.ExecContext(ctx, "UPDATE wine SET quantity = quantity - 1 WHERE id = ?", c.WineID); err != nil {
		return nil, fmt.Errorf("decrementing wine quantity: %w", err)
	}

	id, err := res.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("getting last insert id: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("committing transaction: %w", err)
	}

	c.ID = int(id)
	return &c, nil
}

type WineSearchResult struct {
	Wine
	GardeStatus string `json:"garde_status"`
}

type SearchFilters struct {
	MealID        *int
	AppellationID *int
	Color         *string
	ReadyNow      bool
}

func gardeStatus(w Wine, year int) string {
	switch {
	case year < w.GardeDebut:
		return "too_young"
	case year > w.GardeFin:
		return "past_peak"
	default:
		return "ready"
	}
}

func (d *DB) SearchWines(ctx context.Context, f SearchFilters) ([]WineSearchResult, error) {
	query := `
		SELECT wine.id, wine.millesime, wine.appellation_id, wine.producer_id, producer.name, wine.color, wine.garde_debut, wine.garde_fin, wine.quantity
		FROM wine
		JOIN producer ON producer.id = wine.producer_id
		WHERE wine.quantity > 0
	`
	var args []interface{}

	if f.AppellationID != nil {
		query += " AND wine.appellation_id = ?"
		args = append(args, *f.AppellationID)
	}
	if f.Color != nil {
		if err := validateColor(*f.Color); err != nil {
			return nil, err
		}
		query += " AND wine.color = ?"
		args = append(args, *f.Color)
	}
	if f.MealID != nil {
		query += `
			AND EXISTS (
				SELECT 1 FROM meal_pairing mp
				WHERE mp.appellation_id = wine.appellation_id
				  AND mp.color = wine.color
				  AND mp.meal_id = ?
			)
		`
		args = append(args, *f.MealID)
	}
	query += " ORDER BY wine.id"

	rows, err := d.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("searching wines: %w", err)
	}
	defer rows.Close()

	year := time.Now().Year()
	var results []WineSearchResult
	for rows.Next() {
		var w Wine
		if err := rows.Scan(&w.ID, &w.Millesime, &w.AppellationID, &w.ProducerID, &w.Producer.Name, &w.Color, &w.GardeDebut, &w.GardeFin, &w.Quantity); err != nil {
			return nil, fmt.Errorf("scanning wine: %w", err)
		}
		w.Producer.ID = w.ProducerID

		status := gardeStatus(w, year)
		if f.ReadyNow && status != "ready" {
			continue
		}

		results = append(results, WineSearchResult{Wine: w, GardeStatus: status})
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating wines: %w", err)
	}

	return results, nil
}

func (d *DB) ListConsumptions(ctx context.Context, wineID int) ([]Consumption, error) {
	rows, err := d.QueryContext(ctx, `
		SELECT id, wine_id, date, rating, notes FROM consumption WHERE wine_id = ? ORDER BY date, id
	`, wineID)
	if err != nil {
		return nil, fmt.Errorf("querying consumptions: %w", err)
	}
	defer rows.Close()

	var consumptions []Consumption
	for rows.Next() {
		var c Consumption
		var date time.Time
		if err := rows.Scan(&c.ID, &c.WineID, &date, &c.Rating, &c.Notes); err != nil {
			return nil, fmt.Errorf("scanning consumption: %w", err)
		}
		c.Date = date.Format("2006-01-02")
		consumptions = append(consumptions, c)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating consumptions: %w", err)
	}

	return consumptions, nil
}
