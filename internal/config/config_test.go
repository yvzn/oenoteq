package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDefaultDBPath_ResolvesBesideExecutable(t *testing.T) {
	exe, err := os.Executable()
	if err != nil {
		t.Fatalf("os.Executable() error = %v", err)
	}

	got, err := DefaultDBPath()
	if err != nil {
		t.Fatalf("DefaultDBPath() error = %v", err)
	}

	want := filepath.Join(filepath.Dir(exe), "cellar.db")
	if got != want {
		t.Fatalf("DefaultDBPath() = %q, want %q", got, want)
	}
}

func TestDBPath_UsesEnvOverrideWhenSet(t *testing.T) {
	t.Setenv("DB_PATH", "/tmp/custom.db")

	got, err := DBPath()
	if err != nil {
		t.Fatalf("DBPath() error = %v", err)
	}
	if got != "/tmp/custom.db" {
		t.Fatalf("DBPath() = %q, want %q", got, "/tmp/custom.db")
	}
}

func TestDBPath_FallsBackToDefaultWhenEnvUnset(t *testing.T) {
	t.Setenv("DB_PATH", "")

	got, err := DBPath()
	if err != nil {
		t.Fatalf("DBPath() error = %v", err)
	}

	want, err := DefaultDBPath()
	if err != nil {
		t.Fatalf("DefaultDBPath() error = %v", err)
	}
	if got != want {
		t.Fatalf("DBPath() = %q, want %q", got, want)
	}
}
