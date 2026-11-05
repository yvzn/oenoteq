// Package config resolves runtime configuration, such as where the SQLite
// database file lives.
package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
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

// Port returns the listen address, ":8080" unless overridden by PORT.
func Port() (string, error) {
	if port := os.Getenv("PORT"); port != "" {
		n, err := strconv.Atoi(port)
		if err != nil || n < 1 || n > 65535 {
			return "", fmt.Errorf("invalid PORT %q: must be a number between 1 and 65535", port)
		}
		return ":" + strconv.Itoa(n), nil
	}
	return ":8080", nil
}
