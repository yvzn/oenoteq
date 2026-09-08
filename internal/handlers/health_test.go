package handlers

import (
	"net/http"
	"testing"

	"github.com/younited/wine-cellar-tracker/internal/test"
)

func TestHealth(t *testing.T) {
	mux := http.NewServeMux()
	handler := New(nil) // DB not used by health endpoint
	handler.Register(mux)

	harness := test.New(t, mux)

	resp := harness.Do("GET", "/health", nil)

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, resp.StatusCode)
	}

	var body map[string]string
	harness.JSONResponse(resp, &body)

	if body["status"] != "ok" {
		t.Errorf("Expected status 'ok', got %q", body["status"])
	}
}
