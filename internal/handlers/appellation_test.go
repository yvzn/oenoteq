package handlers

import (
	"net/http"
	"strconv"
	"testing"

	"github.com/younited/wine-cellar-tracker/internal/db"
)

func TestAppellationRename(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Chablis")

	resp := harness.Do("PUT", "/appellations/"+strconv.Itoa(appellationID), map[string]string{"name": "Chablis Grand Cru"})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status %d, got %d", http.StatusOK, resp.StatusCode)
	}

	var updated db.Appellation
	harness.JSONResponse(resp, &updated)
	if updated.ID != appellationID {
		t.Errorf("Expected same id %d, got %d", appellationID, updated.ID)
	}
	if updated.Name != "Chablis Grand Cru" {
		t.Errorf("Expected name 'Chablis Grand Cru', got %q", updated.Name)
	}

	resp = harness.Do("GET", "/appellations", nil)
	var appellations []db.Appellation
	harness.JSONResponse(resp, &appellations)
	if len(appellations) != 1 || appellations[0].Name != "Chablis Grand Cru" {
		t.Errorf("Expected persisted renamed appellation, got %+v", appellations)
	}
}

func TestAppellationRenameRejectsDuplicate(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	createTestAppellation(t, harness, "Chablis")
	appellationID := createTestAppellation(t, harness, "Sancerre")

	resp := harness.Do("PUT", "/appellations/"+strconv.Itoa(appellationID), map[string]string{"name": "Chablis"})
	if resp.StatusCode != http.StatusConflict {
		t.Errorf("Expected status %d, got %d", http.StatusConflict, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "already_exists" {
		t.Errorf("Expected error code 'already_exists', got %q", code)
	}
}

func TestAppellationCreateIdempotentByClientID(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)

	resp := harness.Do("POST", "/appellations", map[string]interface{}{
		"name":      "Chablis",
		"client_id": "client-abc",
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}
	var first db.Appellation
	harness.JSONResponse(resp, &first)

	resp = harness.Do("POST", "/appellations", map[string]interface{}{
		"name":      "Chablis",
		"client_id": "client-abc",
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d on retry, got %d", http.StatusCreated, resp.StatusCode)
	}
	var retried db.Appellation
	harness.JSONResponse(resp, &retried)
	if retried.ID != first.ID {
		t.Errorf("Expected retried create to return original id %d, got %d", first.ID, retried.ID)
	}

	resp = harness.Do("POST", "/appellations", map[string]interface{}{
		"name":      "Sancerre",
		"client_id": "client-def",
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}
	var second db.Appellation
	harness.JSONResponse(resp, &second)
	if second.ID == first.ID {
		t.Errorf("Expected distinct id for different client_id, got same id %d", second.ID)
	}

	resp = harness.Do("GET", "/appellations", nil)
	var appellations []db.Appellation
	harness.JSONResponse(resp, &appellations)
	if len(appellations) != 2 {
		t.Errorf("Expected 2 appellations, got %d", len(appellations))
	}
}

func TestAppellationRenameNotFound(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)

	resp := harness.Do("PUT", "/appellations/9999", map[string]string{"name": "Ghost Appellation"})
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "appellation_not_found" {
		t.Errorf("Expected error code 'appellation_not_found', got %q", code)
	}
}

func TestAppellationDelete(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Chablis")

	resp := harness.Do("DELETE", "/appellations/"+strconv.Itoa(appellationID), nil)
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("Expected status %d, got %d", http.StatusNoContent, resp.StatusCode)
	}

	resp = harness.Do("GET", "/appellations", nil)
	var appellations []db.Appellation
	harness.JSONResponse(resp, &appellations)
	if len(appellations) != 0 {
		t.Errorf("Expected 0 appellations after delete, got %d", len(appellations))
	}
}

func TestAppellationDeleteBlockedWhenReferencedByWine(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Chablis")
	producerID := createTestProducer(t, harness, uniqueTestProducerName("Domaine Test"))

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"millesime":      2018,
		"appellation_id": appellationID,
		"producer_id":    producerID,
		"color":          "blanc",
		"garde_debut":    2020,
		"garde_fin":      2028,
		"quantity":       6,
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}

	resp = harness.Do("DELETE", "/appellations/"+strconv.Itoa(appellationID), nil)
	if resp.StatusCode != http.StatusConflict {
		t.Errorf("Expected status %d, got %d", http.StatusConflict, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "appellation_in_use" {
		t.Errorf("Expected error code 'appellation_in_use', got %q", code)
	}

	resp = harness.Do("GET", "/appellations", nil)
	var appellations []db.Appellation
	harness.JSONResponse(resp, &appellations)
	if len(appellations) != 1 {
		t.Errorf("Expected appellation to survive blocked delete, got %d appellations", len(appellations))
	}
}

func TestAppellationDeleteBlockedWhenReferencedByMealPairing(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Chablis")
	mealID := createTestMeal(t, harness, "Oysters")

	resp := harness.Do("POST", "/meal-pairings", map[string]interface{}{
		"appellation_id": appellationID,
		"color":          "blanc",
		"meal_id":        mealID,
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}

	resp = harness.Do("DELETE", "/appellations/"+strconv.Itoa(appellationID), nil)
	if resp.StatusCode != http.StatusConflict {
		t.Errorf("Expected status %d, got %d", http.StatusConflict, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "appellation_in_use" {
		t.Errorf("Expected error code 'appellation_in_use', got %q", code)
	}

	resp = harness.Do("GET", "/appellations", nil)
	var appellations []db.Appellation
	harness.JSONResponse(resp, &appellations)
	if len(appellations) != 1 {
		t.Errorf("Expected appellation to survive blocked delete, got %d appellations", len(appellations))
	}
}

func TestAppellationDeleteNotFound(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)

	resp := harness.Do("DELETE", "/appellations/9999", nil)
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "appellation_not_found" {
		t.Errorf("Expected error code 'appellation_not_found', got %q", code)
	}
}
