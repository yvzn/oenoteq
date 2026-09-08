package db

import (
	"context"
	"database/sql"
	"embed"
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
