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
