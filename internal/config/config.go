// Package config resolves runtime configuration, such as where the SQLite
// database file lives.
package config

import (
	"os"
	"path/filepath"
)

// DefaultDBPath resolves cellar.db beside the running executable, so the
// database is found regardless of the current working directory the
// executable was launched from.
func DefaultDBPath() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	return filepath.Join(filepath.Dir(exe), "cellar.db"), nil
}

// DBPath returns the DB_PATH env var when set, otherwise DefaultDBPath().
func DBPath() (string, error) {
	if path := os.Getenv("DB_PATH"); path != "" {
		return path, nil
	}
	return DefaultDBPath()
}
