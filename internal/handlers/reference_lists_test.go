package handlers

import (
	"context"
	"net/http"
	"testing"

	"github.com/younited/wine-cellar-tracker/internal/db"
	"github.com/younited/wine-cellar-tracker/internal/test"
)

func setupHandlerWithDB(t *testing.T) (*test.Harness, *db.DB) {
	t.Helper()

	database, err := db.Open(":memory:")
	if err != nil {
		t.Fatalf("Opening database: %v", err)
	}

	if err := database.Migrate(context.Background()); err != nil {
		t.Fatalf("Migrating database: %v", err)
	}

	mux := http.NewServeMux()
	handler := New(database)
	handler.Register(mux, http.NotFoundHandler())

	harness := test.New(t, mux)
	t.Cleanup(func() {
		database.Close()
	})

	return harness, database
}

func TestAppellationCreateAndList(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)

	resp := harness.Do("POST", "/appellations", map[string]string{
		"name": "Burgundy",
	})

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}

	var createdAppellation db.Appellation
	harness.JSONResponse(resp, &createdAppellation)

	if createdAppellation.Name != "Burgundy" {
		t.Errorf("Expected name 'Burgundy', got %q", createdAppellation.Name)
	}

	if createdAppellation.ID == 0 {
		t.Errorf("Expected non-zero ID")
	}

	resp = harness.Do("POST", "/appellations", map[string]string{
		"name": "Bordeaux",
	})

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}

	resp = harness.Do("GET", "/appellations", nil)

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, resp.StatusCode)
	}

	var appellations []db.Appellation
	harness.JSONResponse(resp, &appellations)

	if len(appellations) != 2 {
		t.Errorf("Expected 2 appellations, got %d", len(appellations))
	}

	if appellations[0].Name != "Bordeaux" {
		t.Errorf("Expected first appellations to be 'Bordeaux' (ordered), got %q", appellations[0].Name)
	}

	if appellations[1].Name != "Burgundy" {
		t.Errorf("Expected second appellations to be 'Burgundy' (ordered), got %q", appellations[1].Name)
	}
}

func TestAppellationDuplicateRejection(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)

	resp := harness.Do("POST", "/appellations", map[string]string{
		"name": "Burgundy",
	})

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}

	resp = harness.Do("POST", "/appellations", map[string]string{
		"name": "Burgundy",
	})

	if resp.StatusCode != http.StatusConflict {
		t.Errorf("Expected status %d, got %d", http.StatusConflict, resp.StatusCode)
	}

	if code := harness.ErrorCode(resp); code != "already_exists" {
		t.Errorf("Expected error code 'already_exists', got %q", code)
	}
}

func TestMealCreateAndList(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)

	resp := harness.Do("POST", "/meals", map[string]string{
		"name": "Grilled Salmon",
	})

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}

	var createdMeal db.Meal
	harness.JSONResponse(resp, &createdMeal)

	if createdMeal.Name != "Grilled Salmon" {
		t.Errorf("Expected name 'Grilled Salmon', got %q", createdMeal.Name)
	}

	if createdMeal.ID == 0 {
		t.Errorf("Expected non-zero ID")
	}

	resp = harness.Do("POST", "/meals", map[string]string{
		"name": "Beef Stew",
	})

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}

	resp = harness.Do("GET", "/meals", nil)

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, resp.StatusCode)
	}

	var meals []db.Meal
	harness.JSONResponse(resp, &meals)

	if len(meals) != 2 {
		t.Errorf("Expected 2 meals, got %d", len(meals))
	}

	if meals[0].Name != "Beef Stew" {
		t.Errorf("Expected first meal to be 'Beef Stew' (ordered), got %q", meals[0].Name)
	}

	if meals[1].Name != "Grilled Salmon" {
		t.Errorf("Expected second meal to be 'Grilled Salmon' (ordered), got %q", meals[1].Name)
	}
}

func TestMealDuplicateRejection(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)

	resp := harness.Do("POST", "/meals", map[string]string{
		"name": "Grilled Salmon",
	})

	if resp.StatusCode != http.StatusCreated {
		t.Errorf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}

	resp = harness.Do("POST", "/meals", map[string]string{
		"name": "Grilled Salmon",
	})

	if resp.StatusCode != http.StatusConflict {
		t.Errorf("Expected status %d, got %d", http.StatusConflict, resp.StatusCode)
	}

	if code := harness.ErrorCode(resp); code != "already_exists" {
		t.Errorf("Expected error code 'already_exists', got %q", code)
	}
}
