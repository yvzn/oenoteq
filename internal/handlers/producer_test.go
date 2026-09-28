package handlers

import (
	"net/http"
	"strconv"
	"testing"

	"github.com/younited/wine-cellar-tracker/internal/db"
)

func TestProducerRename(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	producerID := createTestProducer(t, harness, uniqueTestProducerName("Domaine Test"))

	resp := harness.Do("PUT", "/producers/"+strconv.Itoa(producerID), map[string]string{"name": "Domaine Renamed"})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status %d, got %d", http.StatusOK, resp.StatusCode)
	}

	var updated db.Producer
	harness.JSONResponse(resp, &updated)
	if updated.ID != producerID {
		t.Errorf("Expected same id %d, got %d", producerID, updated.ID)
	}
	if updated.Name != "Domaine Renamed" {
		t.Errorf("Expected name 'Domaine Renamed', got %q", updated.Name)
	}

	resp = harness.Do("GET", "/producers", nil)
	var producers []db.Producer
	harness.JSONResponse(resp, &producers)
	if len(producers) != 1 || producers[0].Name != "Domaine Renamed" {
		t.Errorf("Expected persisted renamed producer, got %+v", producers)
	}
}

func TestProducerCreateIdempotentByClientID(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	name := uniqueTestProducerName("Domaine Test")

	resp := harness.Do("POST", "/producers", map[string]interface{}{
		"name":      name,
		"client_id": "client-abc",
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}
	var first db.Producer
	harness.JSONResponse(resp, &first)

	resp = harness.Do("POST", "/producers", map[string]interface{}{
		"name":      name,
		"client_id": "client-abc",
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d on retry, got %d", http.StatusCreated, resp.StatusCode)
	}
	var retried db.Producer
	harness.JSONResponse(resp, &retried)
	if retried.ID != first.ID {
		t.Errorf("Expected retried create to return original id %d, got %d", first.ID, retried.ID)
	}

	resp = harness.Do("POST", "/producers", map[string]interface{}{
		"name":      uniqueTestProducerName("Domaine Other"),
		"client_id": "client-def",
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}
	var second db.Producer
	harness.JSONResponse(resp, &second)
	if second.ID == first.ID {
		t.Errorf("Expected distinct id for different client_id, got same id %d", second.ID)
	}

	resp = harness.Do("GET", "/producers", nil)
	var producers []db.Producer
	harness.JSONResponse(resp, &producers)
	if len(producers) != 2 {
		t.Errorf("Expected 2 producers, got %d", len(producers))
	}
}

func TestProducerRenameRejectsDuplicate(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	existing := uniqueTestProducerName("Domaine A")
	createTestProducer(t, harness, existing)
	producerID := createTestProducer(t, harness, uniqueTestProducerName("Domaine B"))

	resp := harness.Do("PUT", "/producers/"+strconv.Itoa(producerID), map[string]string{"name": existing})
	if resp.StatusCode != http.StatusConflict {
		t.Errorf("Expected status %d, got %d", http.StatusConflict, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "already_exists" {
		t.Errorf("Expected error code 'already_exists', got %q", code)
	}
}

func TestProducerRenameNotFound(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)

	resp := harness.Do("PUT", "/producers/9999", map[string]string{"name": "Ghost Producer"})
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "producer_not_found" {
		t.Errorf("Expected error code 'producer_not_found', got %q", code)
	}
}

func TestProducerDelete(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	producerID := createTestProducer(t, harness, uniqueTestProducerName("Domaine Test"))

	resp := harness.Do("DELETE", "/producers/"+strconv.Itoa(producerID), nil)
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("Expected status %d, got %d", http.StatusNoContent, resp.StatusCode)
	}

	resp = harness.Do("GET", "/producers", nil)
	var producers []db.Producer
	harness.JSONResponse(resp, &producers)
	if len(producers) != 0 {
		t.Errorf("Expected 0 producers after delete, got %d", len(producers))
	}
}

func TestProducerDeleteBlockedWhenReferencedByWine(t *testing.T) {
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

	resp = harness.Do("DELETE", "/producers/"+strconv.Itoa(producerID), nil)
	if resp.StatusCode != http.StatusConflict {
		t.Errorf("Expected status %d, got %d", http.StatusConflict, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "producer_in_use" {
		t.Errorf("Expected error code 'producer_in_use', got %q", code)
	}

	resp = harness.Do("GET", "/producers", nil)
	var producers []db.Producer
	harness.JSONResponse(resp, &producers)
	if len(producers) != 1 {
		t.Errorf("Expected producer to survive blocked delete, got %d producers", len(producers))
	}
}

func TestProducerDeleteNotFound(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)

	resp := harness.Do("DELETE", "/producers/9999", nil)
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "producer_not_found" {
		t.Errorf("Expected error code 'producer_not_found', got %q", code)
	}
}
