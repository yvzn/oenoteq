package db

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"sort"
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
	// Without a busy_timeout, a request that lands while another connection
	// holds a write lock fails immediately (SQLITE_BUSY) instead of waiting
	// for it to clear — WAL lets readers and a writer proceed concurrently,
	// and busy_timeout is the backstop for the remaining writer-vs-writer case.
	// synchronous=NORMAL is safe under WAL (still fsyncs on checkpoint) and
	// only risks losing the last commit on an OS crash/power loss, which is
	// an acceptable trade for a single-user home-LAN box (ADR-0002).
	// foreign_keys is off by default in SQLite — turn it on so a dangling
	// reference (e.g. a wine pointing at a deleted appellation) is rejected
	// instead of silently persisted.
	sqlDB, err := sql.Open("sqlite", "file:"+path+
		"?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=synchronous(NORMAL)&_pragma=foreign_keys(1)")
	if err != nil {
		return nil, fmt.Errorf("opening sqlite: %w", err)
	}

	// SQLite only ever has one writer anyway, and a ":memory:" database (used
	// by tests) isn't shared across connections in database/sql — a second
	// pooled connection would silently see a blank, un-migrated database.
	// One connection total sidesteps that risk; the lost read/write
	// concurrency WAL would otherwise give doesn't matter at this app's
	// single-user scale.
	sqlDB.SetMaxOpenConns(1)

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
	ID        int       `json:"id"`
	ClientID  *string   `json:"client_id"`
	Name      string    `json:"name"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (d *DB) appellationByClientID(ctx context.Context, clientID string) (*Appellation, error) {
	var id int
	err := d.QueryRowContext(ctx, "SELECT id FROM appellation WHERE client_id = ?", clientID).Scan(&id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("looking up appellation by client_id: %w", err)
	}
	return d.appellationByID(ctx, id)
}

func (d *DB) appellationByID(ctx context.Context, id int) (*Appellation, error) {
	var a Appellation
	err := d.QueryRowContext(ctx, "SELECT id, client_id, name, updated_at FROM appellation WHERE id = ?", id).
		Scan(&a.ID, &a.ClientID, &a.Name, &a.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("appellation id %d: %w", id, ErrAppellationNotFound)
		}
		return nil, fmt.Errorf("getting appellation: %w", err)
	}
	return &a, nil
}

func (d *DB) CreateAppellation(ctx context.Context, name string, clientID *string) (*Appellation, error) {
	if clientID != nil {
		existing, err := d.appellationByClientID(ctx, *clientID)
		if err != nil {
			return nil, err
		}
		if existing != nil {
			return existing, nil
		}
	}

	res, err := d.ExecContext(ctx, "INSERT INTO appellation (client_id, name, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)", clientID, name)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			// A concurrent request with the same client_id may have won the
			// race between our lookup and this insert; if so, that row is
			// the correct idempotent result rather than a name conflict.
			if clientID != nil {
				if existing, lookupErr := d.appellationByClientID(ctx, *clientID); lookupErr == nil && existing != nil {
					return existing, nil
				}
			}
			return nil, fmt.Errorf("appellation already exists: %s: %w", name, ErrUniqueConstraint)
		}
		return nil, fmt.Errorf("creating appellation: %w", err)
	}

	id, err := res.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("getting last insert id: %w", err)
	}

	return d.appellationByID(ctx, int(id))
}

func (d *DB) ListAppellations(ctx context.Context) ([]Appellation, error) {
	rows, err := d.QueryContext(ctx, "SELECT id, client_id, name, updated_at FROM appellation ORDER BY name")
	if err != nil {
		return nil, fmt.Errorf("querying appellations: %w", err)
	}
	defer rows.Close()

	var appellations []Appellation
	for rows.Next() {
		var a Appellation
		if err := rows.Scan(&a.ID, &a.ClientID, &a.Name, &a.UpdatedAt); err != nil {
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
	res, err := d.ExecContext(ctx, "UPDATE appellation SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", name, id)
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

	return d.appellationByID(ctx, id)
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
	ID        int       `json:"id"`
	ClientID  *string   `json:"client_id"`
	Name      string    `json:"name"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (d *DB) producerByClientID(ctx context.Context, clientID string) (*Producer, error) {
	var id int
	err := d.QueryRowContext(ctx, "SELECT id FROM producer WHERE client_id = ?", clientID).Scan(&id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("looking up producer by client_id: %w", err)
	}
	p, err := d.producerByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (d *DB) CreateProducer(ctx context.Context, name string, clientID *string) (*Producer, error) {
	if clientID != nil {
		existing, err := d.producerByClientID(ctx, *clientID)
		if err != nil {
			return nil, err
		}
		if existing != nil {
			return existing, nil
		}
	}

	res, err := d.ExecContext(ctx, "INSERT INTO producer (client_id, name, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)", clientID, name)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			if clientID != nil {
				if existing, lookupErr := d.producerByClientID(ctx, *clientID); lookupErr == nil && existing != nil {
					return existing, nil
				}
			}
			return nil, fmt.Errorf("producer already exists: %s: %w", name, ErrUniqueConstraint)
		}
		return nil, fmt.Errorf("creating producer: %w", err)
	}

	id, err := res.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("getting last insert id: %w", err)
	}

	p, err := d.producerByID(ctx, int(id))
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (d *DB) ListProducers(ctx context.Context) ([]Producer, error) {
	rows, err := d.QueryContext(ctx, "SELECT id, client_id, name, updated_at FROM producer ORDER BY name")
	if err != nil {
		return nil, fmt.Errorf("querying producers: %w", err)
	}
	defer rows.Close()

	var producers []Producer
	for rows.Next() {
		var p Producer
		if err := rows.Scan(&p.ID, &p.ClientID, &p.Name, &p.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scanning producer: %w", err)
		}
		producers = append(producers, p)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating producers: %w", err)
	}

	return producers, nil
}

func (d *DB) UpdateProducer(ctx context.Context, id int, name string) (*Producer, error) {
	res, err := d.ExecContext(ctx, "UPDATE producer SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", name, id)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return nil, fmt.Errorf("producer already exists: %s: %w", name, ErrUniqueConstraint)
		}
		return nil, fmt.Errorf("updating producer: %w", err)
	}

	affected, err := res.RowsAffected()
	if err != nil {
		return nil, fmt.Errorf("getting rows affected: %w", err)
	}
	if affected == 0 {
		return nil, fmt.Errorf("producer id %d: %w", id, ErrProducerNotFound)
	}

	p, err := d.producerByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// DeleteProducer explicitly checks for referencing wine rows before
// deleting, since FK enforcement is off repo-wide and there's no ON DELETE
// behavior to lean on.
func (d *DB) DeleteProducer(ctx context.Context, id int) error {
	if err := d.producerExists(ctx, id); err != nil {
		return err
	}

	var inUse int
	if err := d.QueryRowContext(ctx, "SELECT COUNT(*) FROM wine WHERE producer_id = ?", id).Scan(&inUse); err != nil {
		return fmt.Errorf("checking wine references: %w", err)
	}
	if inUse > 0 {
		return fmt.Errorf("producer id %d: %w", id, ErrProducerInUse)
	}

	if _, err := d.ExecContext(ctx, "DELETE FROM producer WHERE id = ?", id); err != nil {
		return fmt.Errorf("deleting producer: %w", err)
	}

	return nil
}

type Meal struct {
	ID        int       `json:"id"`
	ClientID  *string   `json:"client_id"`
	Name      string    `json:"name"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (d *DB) mealByClientID(ctx context.Context, clientID string) (*Meal, error) {
	var id int
	err := d.QueryRowContext(ctx, "SELECT id FROM meal WHERE client_id = ?", clientID).Scan(&id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("looking up meal by client_id: %w", err)
	}
	return d.mealByID(ctx, id)
}

func (d *DB) mealByID(ctx context.Context, id int) (*Meal, error) {
	var m Meal
	err := d.QueryRowContext(ctx, "SELECT id, client_id, name, updated_at FROM meal WHERE id = ?", id).
		Scan(&m.ID, &m.ClientID, &m.Name, &m.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("meal id %d: %w", id, ErrMealNotFound)
		}
		return nil, fmt.Errorf("getting meal: %w", err)
	}
	return &m, nil
}

func (d *DB) CreateMeal(ctx context.Context, name string, clientID *string) (*Meal, error) {
	if clientID != nil {
		existing, err := d.mealByClientID(ctx, *clientID)
		if err != nil {
			return nil, err
		}
		if existing != nil {
			return existing, nil
		}
	}

	res, err := d.ExecContext(ctx, "INSERT INTO meal (client_id, name, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)", clientID, name)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			if clientID != nil {
				if existing, lookupErr := d.mealByClientID(ctx, *clientID); lookupErr == nil && existing != nil {
					return existing, nil
				}
			}
			return nil, fmt.Errorf("meal already exists: %s: %w", name, ErrUniqueConstraint)
		}
		return nil, fmt.Errorf("creating meal: %w", err)
	}

	id, err := res.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("getting last insert id: %w", err)
	}

	return d.mealByID(ctx, int(id))
}

func (d *DB) ListMeals(ctx context.Context) ([]Meal, error) {
	rows, err := d.QueryContext(ctx, "SELECT id, client_id, name, updated_at FROM meal ORDER BY name")
	if err != nil {
		return nil, fmt.Errorf("querying meals: %w", err)
	}
	defer rows.Close()

	var meals []Meal
	for rows.Next() {
		var m Meal
		if err := rows.Scan(&m.ID, &m.ClientID, &m.Name, &m.UpdatedAt); err != nil {
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
	res, err := d.ExecContext(ctx, "UPDATE meal SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", name, id)
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

	return d.mealByID(ctx, id)
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
	ErrInvalidColor            = errors.New("invalid color")
	ErrAppellationNotFound     = errors.New("appellation not found")
	ErrProducerNotFound        = errors.New("producer not found")
	ErrWineNotFound            = errors.New("wine not found")
	ErrMealNotFound            = errors.New("meal not found")
	ErrMealInUse               = errors.New("meal is in use")
	ErrAppellationInUse        = errors.New("appellation is in use")
	ErrProducerInUse           = errors.New("producer is in use")
	ErrDateRequired            = errors.New("date is required")
	ErrInvalidDate             = errors.New("date must be in YYYY-MM-DD format")
	ErrInvalidRating           = errors.New("rating must be between 1 and 5")
	ErrQuantityZero            = errors.New("wine quantity is already 0")
	ErrConsumptionNotFound     = errors.New("consumption not found")
	ErrInvalidSort             = errors.New("invalid sort")
	ErrInitialQuantityRequired = errors.New("initial quantity is required and must be at least 1")
)

var validColors = map[string]bool{"rouge": true, "blanc": true, "rose": true}

var validSortBy = map[string]bool{"producer": true, "appellation": true, "millesime": true, "status": true}

var validSortDir = map[string]bool{"asc": true, "desc": true}

// gardeStatusSortRank orders Garde Status ascending per CONTEXT.md's
// definition sequence; descending reverses it.
var gardeStatusSortRank = map[string]int{"too_young": 0, "ready": 1, "past_peak": 2, "unassessed": 3}

type Wine struct {
	ID            int       `json:"id"`
	ClientID      *string   `json:"client_id"`
	Millesime     *int      `json:"millesime"`
	AppellationID int       `json:"appellation_id"`
	ProducerID    int       `json:"producer_id"`
	Producer      Producer  `json:"producer"`
	Color         string    `json:"color"`
	GardeDebut    *int      `json:"garde_debut"`
	GardeFin      *int      `json:"garde_fin"`
	Quantity      int       `json:"quantity"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// validateWine checks the fields a client can set directly. Quantity is
// excluded: it's never accepted from Wine create/update requests, only
// mutated via Consumption creation and quantity_adjustment (ADR-0006).
func validateWine(w Wine) error {
	if !validColors[w.Color] {
		return fmt.Errorf("%q: %w", w.Color, ErrInvalidColor)
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

func (d *DB) producerExists(ctx context.Context, id int) error {
	var exists int
	if err := d.QueryRowContext(ctx, "SELECT COUNT(*) FROM producer WHERE id = ?", id).Scan(&exists); err != nil {
		return fmt.Errorf("checking producer: %w", err)
	}
	if exists == 0 {
		return fmt.Errorf("producer id %d: %w", id, ErrProducerNotFound)
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

func (d *DB) wineByClientID(ctx context.Context, clientID string) (*Wine, error) {
	var id int
	err := d.QueryRowContext(ctx, "SELECT id FROM wine WHERE client_id = ?", clientID).Scan(&id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("looking up wine by client_id: %w", err)
	}
	return d.GetWine(ctx, id)
}

// CreateWine inserts a Wine and applies initialQuantity (must be >=1) as the
// first quantity_adjustment (reason "manual") in the same transaction, so a
// wine is never left stuck at 0 stock reachable only via its own detail page
// (ADR-0007).
func (d *DB) CreateWine(ctx context.Context, w Wine, initialQuantity int) (*Wine, error) {
	if err := validateWine(w); err != nil {
		return nil, err
	}
	if initialQuantity < 1 {
		return nil, ErrInitialQuantityRequired
	}
	if w.ClientID != nil {
		existing, err := d.wineByClientID(ctx, *w.ClientID)
		if err != nil {
			return nil, err
		}
		if existing != nil {
			return existing, nil
		}
	}
	if err := d.appellationExists(ctx, w.AppellationID); err != nil {
		return nil, err
	}
	if _, err := d.producerByID(ctx, w.ProducerID); err != nil {
		return nil, err
	}

	tx, err := d.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(ctx, `
		INSERT INTO wine (client_id, millesime, appellation_id, producer_id, color, garde_debut, garde_fin, quantity, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
	`, w.ClientID, w.Millesime, w.AppellationID, w.ProducerID, w.Color, w.GardeDebut, w.GardeFin)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") && w.ClientID != nil {
			// Roll back before falling back to a lookup on d (not tx) —
			// otherwise this read would block forever on the write lock
			// still held by our own open, uncommitted transaction.
			tx.Rollback()
			if existing, lookupErr := d.wineByClientID(ctx, *w.ClientID); lookupErr == nil && existing != nil {
				return existing, nil
			}
		}
		return nil, fmt.Errorf("creating wine: %w", err)
	}

	id, err := res.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("getting last insert id: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO quantity_adjustment (client_id, wine_id, delta, reason, created_at) VALUES (NULL, ?, ?, 'manual', CURRENT_TIMESTAMP)
	`, id, initialQuantity); err != nil {
		return nil, fmt.Errorf("creating initial quantity adjustment: %w", err)
	}

	if _, err := tx.ExecContext(ctx, "UPDATE wine SET quantity = ? WHERE id = ?", initialQuantity, id); err != nil {
		return nil, fmt.Errorf("applying initial quantity: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("committing transaction: %w", err)
	}

	return d.GetWine(ctx, int(id))
}

func (d *DB) GetWine(ctx context.Context, id int) (*Wine, error) {
	var w Wine
	err := d.QueryRowContext(ctx, `
		SELECT wine.id, wine.client_id, wine.millesime, wine.appellation_id, wine.producer_id, producer.name, wine.color, wine.garde_debut, wine.garde_fin, wine.quantity, wine.updated_at
		FROM wine JOIN producer ON producer.id = wine.producer_id
		WHERE wine.id = ?
	`, id).Scan(&w.ID, &w.ClientID, &w.Millesime, &w.AppellationID, &w.ProducerID, &w.Producer.Name, &w.Color, &w.GardeDebut, &w.GardeFin, &w.Quantity, &w.UpdatedAt)
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
		SELECT wine.id, wine.client_id, wine.millesime, wine.appellation_id, wine.producer_id, producer.name, wine.color, wine.garde_debut, wine.garde_fin, wine.quantity, wine.updated_at
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
		if err := rows.Scan(&w.ID, &w.ClientID, &w.Millesime, &w.AppellationID, &w.ProducerID, &w.Producer.Name, &w.Color, &w.GardeDebut, &w.GardeFin, &w.Quantity, &w.UpdatedAt); err != nil {
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
	if _, err := d.producerByID(ctx, w.ProducerID); err != nil {
		return nil, err
	}

	// quantity is deliberately absent: it's never set from a Wine update,
	// only mutated via Consumption creation and quantity_adjustment.
	res, err := d.ExecContext(ctx, `
		UPDATE wine
		SET millesime = ?, appellation_id = ?, producer_id = ?, color = ?, garde_debut = ?, garde_fin = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, w.Millesime, w.AppellationID, w.ProducerID, w.Color, w.GardeDebut, w.GardeFin, id)
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

	return d.GetWine(ctx, id)
}

type Consumption struct {
	ID        int       `json:"id"`
	ClientID  *string   `json:"client_id"`
	WineID    int       `json:"wine_id"`
	Date      string    `json:"date"`
	Rating    *int      `json:"rating"`
	Notes     *string   `json:"notes"`
	UpdatedAt time.Time `json:"updated_at"`
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

func (d *DB) consumptionByClientID(ctx context.Context, clientID string) (*Consumption, error) {
	var id int
	err := d.QueryRowContext(ctx, "SELECT id FROM consumption WHERE client_id = ?", clientID).Scan(&id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("looking up consumption by client_id: %w", err)
	}
	return d.consumptionByID(ctx, id)
}

func (d *DB) consumptionByID(ctx context.Context, id int) (*Consumption, error) {
	var c Consumption
	var date time.Time
	err := d.QueryRowContext(ctx, `
		SELECT id, client_id, wine_id, date, rating, notes, updated_at FROM consumption WHERE id = ?
	`, id).Scan(&c.ID, &c.ClientID, &c.WineID, &date, &c.Rating, &c.Notes, &c.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("consumption id %d: %w", id, ErrConsumptionNotFound)
		}
		return nil, fmt.Errorf("getting consumption: %w", err)
	}
	c.Date = date.Format("2006-01-02")
	return &c, nil
}

func (d *DB) CreateConsumption(ctx context.Context, c Consumption) (*Consumption, error) {
	if err := validateConsumption(c); err != nil {
		return nil, err
	}
	if c.ClientID != nil {
		existing, err := d.consumptionByClientID(ctx, *c.ClientID)
		if err != nil {
			return nil, err
		}
		if existing != nil {
			return existing, nil
		}
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
		INSERT INTO consumption (client_id, wine_id, date, rating, notes, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
	`, c.ClientID, c.WineID, c.Date, c.Rating, c.Notes)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") && c.ClientID != nil {
			// Roll back before falling back to a lookup on d (not tx) —
			// otherwise this read would block forever on the write lock
			// still held by our own open, uncommitted transaction.
			tx.Rollback()
			if existing, lookupErr := d.consumptionByClientID(ctx, *c.ClientID); lookupErr == nil && existing != nil {
				return existing, nil
			}
		}
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

	return d.consumptionByID(ctx, int(id))
}

// QuantityAdjustment is a manual stock correction — the signed-delta
// counterpart to Consumption's implicit -1. Reason is always "manual"; it
// exists to distinguish this ledger from a future non-manual source without
// a schema change.
type QuantityAdjustment struct {
	ID        int       `json:"id"`
	ClientID  *string   `json:"client_id"`
	WineID    int       `json:"wine_id"`
	Delta     int       `json:"delta"`
	Reason    string    `json:"reason"`
	CreatedAt time.Time `json:"created_at"`
}

func (d *DB) quantityAdjustmentByClientID(ctx context.Context, clientID string) (*QuantityAdjustment, error) {
	var a QuantityAdjustment
	err := d.QueryRowContext(ctx, `
		SELECT id, client_id, wine_id, delta, reason, created_at FROM quantity_adjustment WHERE client_id = ?
	`, clientID).Scan(&a.ID, &a.ClientID, &a.WineID, &a.Delta, &a.Reason, &a.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("looking up quantity adjustment by client_id: %w", err)
	}
	return &a, nil
}

// ApplyQuantityAdjustment applies a signed manual delta to a Wine's quantity,
// atomically and idempotently by client_id. Retrying the same client_id
// returns the Wine as it stands now, without reapplying the delta.
func (d *DB) ApplyQuantityAdjustment(ctx context.Context, a QuantityAdjustment) (*Wine, error) {
	if a.ClientID != nil {
		existing, err := d.quantityAdjustmentByClientID(ctx, *a.ClientID)
		if err != nil {
			return nil, err
		}
		if existing != nil {
			return d.GetWine(ctx, existing.WineID)
		}
	}

	tx, err := d.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	var quantity int
	if err := tx.QueryRowContext(ctx, "SELECT quantity FROM wine WHERE id = ?", a.WineID).Scan(&quantity); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("wine id %d: %w", a.WineID, ErrWineNotFound)
		}
		return nil, fmt.Errorf("checking wine quantity: %w", err)
	}
	if quantity+a.Delta < 0 {
		return nil, fmt.Errorf("wine id %d: %w", a.WineID, ErrQuantityZero)
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO quantity_adjustment (client_id, wine_id, delta, reason, created_at) VALUES (?, ?, ?, 'manual', CURRENT_TIMESTAMP)
	`, a.ClientID, a.WineID, a.Delta); err != nil {
		if strings.Contains(err.Error(), "UNIQUE") && a.ClientID != nil {
			// Roll back before falling back to a lookup on d (not tx) —
			// otherwise this read would block forever on the write lock
			// still held by our own open, uncommitted transaction.
			tx.Rollback()
			if existing, lookupErr := d.quantityAdjustmentByClientID(ctx, *a.ClientID); lookupErr == nil && existing != nil {
				return d.GetWine(ctx, existing.WineID)
			}
		}
		return nil, fmt.Errorf("creating quantity adjustment: %w", err)
	}

	if _, err := tx.ExecContext(ctx, "UPDATE wine SET quantity = quantity + ? WHERE id = ?", a.Delta, a.WineID); err != nil {
		return nil, fmt.Errorf("adjusting wine quantity: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("committing transaction: %w", err)
	}

	return d.GetWine(ctx, a.WineID)
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
	SortBy        string
	SortDir       string
}

func validateSort(sortBy, sortDir string) error {
	if !validSortBy[sortBy] {
		return fmt.Errorf("%q: %w", sortBy, ErrInvalidSort)
	}
	if !validSortDir[sortDir] {
		return fmt.Errorf("%q: %w", sortDir, ErrInvalidSort)
	}
	return nil
}

// sortWinesSQL builds the ORDER BY clause for a validated (sortBy, sortDir)
// pair. Producer name (then wine id) always breaks ties, per the agreed
// tie-break rule. Garde Status has no SQL column (computed at read time), so
// "status" only needs a stable base order here; the real ordering happens in
// Go after the query runs.
func sortWinesSQL(sortBy, sortDir string) string {
	switch sortBy {
	case "appellation":
		return "appellation.name " + sortDir + ", producer.name ASC, wine.id ASC"
	case "millesime":
		return "(wine.millesime IS NULL) ASC, wine.millesime " + sortDir + ", producer.name ASC, wine.id ASC"
	case "status":
		return "wine.id ASC"
	default: // "producer"
		return "producer.name " + sortDir + ", wine.id ASC"
	}
}

// sortWinesByStatus orders results by Garde Status ascending/descending,
// following CONTEXT.md's definition sequence, with the same producer-name/id
// tie-break used by the SQL-driven sorts.
func sortWinesByStatus(results []WineSearchResult, sortDir string) {
	sort.SliceStable(results, func(i, j int) bool {
		ri, rj := gardeStatusSortRank[results[i].GardeStatus], gardeStatusSortRank[results[j].GardeStatus]
		if ri != rj {
			if sortDir == "desc" {
				return ri > rj
			}
			return ri < rj
		}
		if results[i].Producer.Name != results[j].Producer.Name {
			return results[i].Producer.Name < results[j].Producer.Name
		}
		return results[i].ID < results[j].ID
	})
}

func gardeStatus(w Wine, year int) string {
	if w.GardeDebut == nil && w.GardeFin == nil {
		return "unassessed"
	}
	if w.GardeDebut != nil && year < *w.GardeDebut {
		return "too_young"
	}
	if w.GardeFin != nil && year > *w.GardeFin {
		return "past_peak"
	}
	return "ready"
}

func (d *DB) SearchWines(ctx context.Context, f SearchFilters) ([]WineSearchResult, error) {
	if err := validateSort(f.SortBy, f.SortDir); err != nil {
		return nil, err
	}

	query := `
		SELECT wine.id, wine.client_id, wine.millesime, wine.appellation_id, wine.producer_id, producer.name, wine.color, wine.garde_debut, wine.garde_fin, wine.quantity, wine.updated_at
		FROM wine
		JOIN producer ON producer.id = wine.producer_id
		JOIN appellation ON appellation.id = wine.appellation_id
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
	query += " ORDER BY " + sortWinesSQL(f.SortBy, f.SortDir)

	rows, err := d.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("searching wines: %w", err)
	}
	defer rows.Close()

	year := time.Now().Year()
	var results []WineSearchResult
	for rows.Next() {
		var w Wine
		if err := rows.Scan(&w.ID, &w.ClientID, &w.Millesime, &w.AppellationID, &w.ProducerID, &w.Producer.Name, &w.Color, &w.GardeDebut, &w.GardeFin, &w.Quantity, &w.UpdatedAt); err != nil {
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

	if f.SortBy == "status" {
		sortWinesByStatus(results, f.SortDir)
	}

	return results, nil
}

func (d *DB) consumptionWineID(ctx context.Context, id int) (int, error) {
	var wineID int
	err := d.QueryRowContext(ctx, "SELECT wine_id FROM consumption WHERE id = ?", id).Scan(&wineID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, fmt.Errorf("consumption id %d: %w", id, ErrConsumptionNotFound)
		}
		return 0, fmt.Errorf("getting consumption: %w", err)
	}
	return wineID, nil
}

// UpdateConsumption re-validates date/rating exactly as CreateConsumption
// does. wine_id is immutable — there is no re-linking to a different Wine.
func (d *DB) UpdateConsumption(ctx context.Context, id int, date string, rating *int, notes *string) (*Consumption, error) {
	c := Consumption{ID: id, Date: date, Rating: rating, Notes: notes}
	if err := validateConsumption(c); err != nil {
		return nil, err
	}

	if _, err := d.consumptionWineID(ctx, id); err != nil {
		return nil, err
	}

	if _, err := d.ExecContext(ctx, `
		UPDATE consumption SET date = ?, rating = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
	`, date, rating, notes, id); err != nil {
		return nil, fmt.Errorf("updating consumption: %w", err)
	}

	return d.consumptionByID(ctx, id)
}

// DeleteConsumption removes the entry and restores the referenced Wine's
// quantity by one, the inverse of the decrement that happens on creation.
func (d *DB) DeleteConsumption(ctx context.Context, id int) error {
	tx, err := d.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback()

	var wineID int
	if err := tx.QueryRowContext(ctx, "SELECT wine_id FROM consumption WHERE id = ?", id).Scan(&wineID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("consumption id %d: %w", id, ErrConsumptionNotFound)
		}
		return fmt.Errorf("checking consumption: %w", err)
	}

	if _, err := tx.ExecContext(ctx, "DELETE FROM consumption WHERE id = ?", id); err != nil {
		return fmt.Errorf("deleting consumption: %w", err)
	}

	if _, err := tx.ExecContext(ctx, "UPDATE wine SET quantity = quantity + 1 WHERE id = ?", wineID); err != nil {
		return fmt.Errorf("incrementing wine quantity: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("committing transaction: %w", err)
	}

	return nil
}

func (d *DB) ListConsumptions(ctx context.Context, wineID int) ([]Consumption, error) {
	rows, err := d.QueryContext(ctx, `
		SELECT id, client_id, wine_id, date, rating, notes, updated_at FROM consumption WHERE wine_id = ? ORDER BY date, id
	`, wineID)
	if err != nil {
		return nil, fmt.Errorf("querying consumptions: %w", err)
	}
	defer rows.Close()

	var consumptions []Consumption
	for rows.Next() {
		var c Consumption
		var date time.Time
		if err := rows.Scan(&c.ID, &c.ClientID, &c.WineID, &date, &c.Rating, &c.Notes, &c.UpdatedAt); err != nil {
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
