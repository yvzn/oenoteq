package handlers

import (
	"net/http"
	"strconv"
	"testing"

	"github.com/younited/wine-cellar-tracker/internal/db"
	"github.com/younited/wine-cellar-tracker/internal/test"
)

func createTestWine(t *testing.T, harness *test.Harness, appellationID, quantity int) db.Wine {
	t.Helper()

	producerID := createTestProducer(t, harness, uniqueTestProducerName("Domaine Test"))

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer_id":    producerID,
		"color":          "rouge",
		"garde_debut":    2020,
		"garde_fin":      2028,
		"quantity":       quantity,
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d creating wine, got %d", http.StatusCreated, resp.StatusCode)
	}

	var wine db.Wine
	harness.JSONResponse(resp, &wine)
	return wine
}

func TestConsumptionRecordDecrementsQuantity(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Chinon")
	wine := createTestWine(t, harness, appellationID, 3)

	rating := 4
	notes := "Great with duck"
	resp := harness.Do("POST", "/wines/"+strconv.Itoa(wine.ID)+"/consumptions", map[string]interface{}{
		"date":   "2026-01-15",
		"rating": rating,
		"notes":  notes,
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}

	var consumption db.Consumption
	harness.JSONResponse(resp, &consumption)

	if consumption.ID == 0 {
		t.Errorf("Expected non-zero ID")
	}
	if consumption.WineID != wine.ID {
		t.Errorf("Expected wine_id %d, got %d", wine.ID, consumption.WineID)
	}
	if consumption.Date != "2026-01-15" {
		t.Errorf("Expected date '2026-01-15', got %q", consumption.Date)
	}
	if consumption.Rating == nil || *consumption.Rating != 4 {
		t.Errorf("Expected rating 4, got %v", consumption.Rating)
	}
	if consumption.Notes == nil || *consumption.Notes != "Great with duck" {
		t.Errorf("Expected notes 'Great with duck', got %v", consumption.Notes)
	}

	resp = harness.Do("GET", "/wines/"+strconv.Itoa(wine.ID), nil)
	var detail db.WineDetail
	harness.JSONResponse(resp, &detail)
	if detail.Quantity != 2 {
		t.Errorf("Expected quantity decremented to 2, got %d", detail.Quantity)
	}
}

func TestConsumptionOptionalRatingAndNotes(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Bourgueil")
	wine := createTestWine(t, harness, appellationID, 1)

	resp := harness.Do("POST", "/wines/"+strconv.Itoa(wine.ID)+"/consumptions", map[string]interface{}{
		"date": "2026-02-01",
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}

	var consumption db.Consumption
	harness.JSONResponse(resp, &consumption)

	if consumption.Rating != nil {
		t.Errorf("Expected nil rating, got %v", *consumption.Rating)
	}
	if consumption.Notes != nil {
		t.Errorf("Expected nil notes, got %v", *consumption.Notes)
	}
}

func TestConsumptionRequiresDate(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Saumur")
	wine := createTestWine(t, harness, appellationID, 1)

	resp := harness.Do("POST", "/wines/"+strconv.Itoa(wine.ID)+"/consumptions", map[string]interface{}{
		"notes": "no date given",
	})
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "date_required" {
		t.Errorf("Expected error code 'date_required', got %q", code)
	}
}

func TestConsumptionRejectsInvalidRating(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Saint-Nicolas-de-Bourgueil")
	wine := createTestWine(t, harness, appellationID, 1)

	resp := harness.Do("POST", "/wines/"+strconv.Itoa(wine.ID)+"/consumptions", map[string]interface{}{
		"date":   "2026-03-01",
		"rating": 6,
	})
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "invalid_rating" {
		t.Errorf("Expected error code 'invalid_rating', got %q", code)
	}

	resp = harness.Do("POST", "/wines/"+strconv.Itoa(wine.ID)+"/consumptions", map[string]interface{}{
		"date":   "2026-03-01",
		"rating": 0,
	})
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, resp.StatusCode)
	}
}

func TestConsumptionAcceptsRatingBoundaries(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Chinon Boundaries")
	wine := createTestWine(t, harness, appellationID, 2)

	for _, rating := range []int{1, 5} {
		resp := harness.Do("POST", "/wines/"+strconv.Itoa(wine.ID)+"/consumptions", map[string]interface{}{
			"date":   "2026-03-10",
			"rating": rating,
		})
		if resp.StatusCode != http.StatusCreated {
			t.Fatalf("Expected status %d for rating %d, got %d", http.StatusCreated, rating, resp.StatusCode)
		}

		var consumption db.Consumption
		harness.JSONResponse(resp, &consumption)
		if consumption.Rating == nil || *consumption.Rating != rating {
			t.Errorf("Expected rating %d, got %v", rating, consumption.Rating)
		}
	}
}

func TestConsumptionRejectsInvalidDateFormat(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Bourgueil Malformed")
	wine := createTestWine(t, harness, appellationID, 1)

	resp := harness.Do("POST", "/wines/"+strconv.Itoa(wine.ID)+"/consumptions", map[string]interface{}{
		"date": "not-a-date",
	})
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "invalid_date" {
		t.Errorf("Expected error code 'invalid_date', got %q", code)
	}
}

func TestConsumptionRejectsWhenQuantityZero(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Anjou")
	wine := createTestWine(t, harness, appellationID, 0)

	resp := harness.Do("POST", "/wines/"+strconv.Itoa(wine.ID)+"/consumptions", map[string]interface{}{
		"date": "2026-04-01",
	})
	if resp.StatusCode != http.StatusConflict {
		t.Errorf("Expected status %d, got %d", http.StatusConflict, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "quantity_zero" {
		t.Errorf("Expected error code 'quantity_zero', got %q", code)
	}

	resp = harness.Do("GET", "/wines/"+strconv.Itoa(wine.ID), nil)
	var detail db.WineDetail
	harness.JSONResponse(resp, &detail)
	if detail.Quantity != 0 {
		t.Errorf("Expected quantity to remain 0, got %d", detail.Quantity)
	}
}

func TestConsumptionForUnknownWine(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)

	resp := harness.Do("POST", "/wines/9999/consumptions", map[string]interface{}{
		"date": "2026-05-01",
	})
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "wine_not_found" {
		t.Errorf("Expected error code 'wine_not_found', got %q", code)
	}
}

func TestConsumptionHistoryListedOnWineDetail(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Chinon Historique")
	wine := createTestWine(t, harness, appellationID, 5)

	harness.Do("POST", "/wines/"+strconv.Itoa(wine.ID)+"/consumptions", map[string]interface{}{
		"date": "2026-01-01",
	})
	harness.Do("POST", "/wines/"+strconv.Itoa(wine.ID)+"/consumptions", map[string]interface{}{
		"date": "2026-02-01",
	})

	resp := harness.Do("GET", "/wines/"+strconv.Itoa(wine.ID), nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status %d, got %d", http.StatusOK, resp.StatusCode)
	}

	var detail db.WineDetail
	harness.JSONResponse(resp, &detail)

	if len(detail.ConsumptionHistory) != 2 {
		t.Fatalf("Expected 2 consumption history entries, got %d", len(detail.ConsumptionHistory))
	}
	if detail.ConsumptionHistory[0].Date != "2026-01-01" || detail.ConsumptionHistory[1].Date != "2026-02-01" {
		t.Errorf("Expected consumption history ordered by date, got %q, %q", detail.ConsumptionHistory[0].Date, detail.ConsumptionHistory[1].Date)
	}
}

func TestConsumptionHistoryEmptyWhenNoneRecorded(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Saumur-Champigny")
	wine := createTestWine(t, harness, appellationID, 2)

	resp := harness.Do("GET", "/wines/"+strconv.Itoa(wine.ID), nil)
	var detail db.WineDetail
	harness.JSONResponse(resp, &detail)

	if detail.ConsumptionHistory == nil {
		t.Errorf("Expected consumption_history to be an empty list, got nil")
	}
	if len(detail.ConsumptionHistory) != 0 {
		t.Errorf("Expected 0 consumption history entries, got %d", len(detail.ConsumptionHistory))
	}
}
