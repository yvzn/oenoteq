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
		"appellation_id":   appellationID,
		"producer_id":      producerID,
		"color":            "rouge",
		"garde_debut":      2020,
		"garde_fin":        2028,
		"initial_quantity": 1,
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d creating wine, got %d", http.StatusCreated, resp.StatusCode)
	}

	var wine db.Wine
	harness.JSONResponse(resp, &wine)
	if delta := quantity - 1; delta != 0 {
		wine = applyQuantityAdjustment(t, harness, wine.ID, delta)
	}
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

func TestConsumptionCreateIdempotentByClientID(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Chinon")
	wine := createTestWine(t, harness, appellationID, 3)

	resp := harness.Do("POST", "/wines/"+strconv.Itoa(wine.ID)+"/consumptions", map[string]interface{}{
		"date":      "2026-01-15",
		"client_id": "client-abc",
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}
	var first db.Consumption
	harness.JSONResponse(resp, &first)

	resp = harness.Do("POST", "/wines/"+strconv.Itoa(wine.ID)+"/consumptions", map[string]interface{}{
		"date":      "2026-01-15",
		"client_id": "client-abc",
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d on retry, got %d", http.StatusCreated, resp.StatusCode)
	}
	var retried db.Consumption
	harness.JSONResponse(resp, &retried)
	if retried.ID != first.ID {
		t.Errorf("Expected retried create to return original id %d, got %d", first.ID, retried.ID)
	}

	resp = harness.Do("GET", "/wines/"+strconv.Itoa(wine.ID), nil)
	var detail db.WineDetail
	harness.JSONResponse(resp, &detail)
	if detail.Quantity != 2 {
		t.Errorf("Expected quantity decremented only once to 2, got %d", detail.Quantity)
	}

	resp = harness.Do("POST", "/wines/"+strconv.Itoa(wine.ID)+"/consumptions", map[string]interface{}{
		"date":      "2026-01-16",
		"client_id": "client-def",
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}
	var second db.Consumption
	harness.JSONResponse(resp, &second)
	if second.ID == first.ID {
		t.Errorf("Expected distinct id for different client_id, got same id %d", second.ID)
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

func TestConsumptionEditDate(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Vouvray")
	wine := createTestWine(t, harness, appellationID, 2)

	resp := harness.Do("POST", "/wines/"+strconv.Itoa(wine.ID)+"/consumptions", map[string]interface{}{
		"date": "2026-01-15",
	})
	var created db.Consumption
	harness.JSONResponse(resp, &created)

	resp = harness.Do("PUT", "/consumptions/"+strconv.Itoa(created.ID), map[string]interface{}{
		"date": "2026-01-20",
	})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status %d, got %d", http.StatusOK, resp.StatusCode)
	}

	var updated db.Consumption
	harness.JSONResponse(resp, &updated)
	if updated.ID != created.ID {
		t.Errorf("Expected same id %d, got %d", created.ID, updated.ID)
	}
	if updated.WineID != wine.ID {
		t.Errorf("Expected wine_id %d, got %d", wine.ID, updated.WineID)
	}
	if updated.Date != "2026-01-20" {
		t.Errorf("Expected date '2026-01-20', got %q", updated.Date)
	}
}

func TestConsumptionEditRating(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Vouvray Rating")
	wine := createTestWine(t, harness, appellationID, 2)

	resp := harness.Do("POST", "/wines/"+strconv.Itoa(wine.ID)+"/consumptions", map[string]interface{}{
		"date":   "2026-01-15",
		"rating": 3,
	})
	var created db.Consumption
	harness.JSONResponse(resp, &created)

	resp = harness.Do("PUT", "/consumptions/"+strconv.Itoa(created.ID), map[string]interface{}{
		"date":   "2026-01-15",
		"rating": 5,
	})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status %d, got %d", http.StatusOK, resp.StatusCode)
	}

	var updated db.Consumption
	harness.JSONResponse(resp, &updated)
	if updated.Rating == nil || *updated.Rating != 5 {
		t.Errorf("Expected rating 5, got %v", updated.Rating)
	}
}

func TestConsumptionEditNotes(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Vouvray Notes")
	wine := createTestWine(t, harness, appellationID, 2)

	resp := harness.Do("POST", "/wines/"+strconv.Itoa(wine.ID)+"/consumptions", map[string]interface{}{
		"date":  "2026-01-15",
		"notes": "original notes",
	})
	var created db.Consumption
	harness.JSONResponse(resp, &created)

	resp = harness.Do("PUT", "/consumptions/"+strconv.Itoa(created.ID), map[string]interface{}{
		"date":  "2026-01-15",
		"notes": "corrected notes",
	})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status %d, got %d", http.StatusOK, resp.StatusCode)
	}

	var updated db.Consumption
	harness.JSONResponse(resp, &updated)
	if updated.Notes == nil || *updated.Notes != "corrected notes" {
		t.Errorf("Expected notes 'corrected notes', got %v", updated.Notes)
	}
}

func TestConsumptionEditReusesCreateValidation(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Vouvray Validation")
	wine := createTestWine(t, harness, appellationID, 2)

	resp := harness.Do("POST", "/wines/"+strconv.Itoa(wine.ID)+"/consumptions", map[string]interface{}{
		"date": "2026-01-15",
	})
	var created db.Consumption
	harness.JSONResponse(resp, &created)

	resp = harness.Do("PUT", "/consumptions/"+strconv.Itoa(created.ID), map[string]interface{}{
		"notes": "no date given",
	})
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "date_required" {
		t.Errorf("Expected error code 'date_required', got %q", code)
	}

	resp = harness.Do("PUT", "/consumptions/"+strconv.Itoa(created.ID), map[string]interface{}{
		"date":   "2026-01-15",
		"rating": 6,
	})
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "invalid_rating" {
		t.Errorf("Expected error code 'invalid_rating', got %q", code)
	}

	resp = harness.Do("PUT", "/consumptions/"+strconv.Itoa(created.ID), map[string]interface{}{
		"date": "not-a-date",
	})
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "invalid_date" {
		t.Errorf("Expected error code 'invalid_date', got %q", code)
	}
}

func TestConsumptionEditNotFound(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)

	resp := harness.Do("PUT", "/consumptions/9999", map[string]interface{}{
		"date": "2026-01-15",
	})
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "consumption_not_found" {
		t.Errorf("Expected error code 'consumption_not_found', got %q", code)
	}
}

func TestConsumptionDelete(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Chinon Delete")
	wine := createTestWine(t, harness, appellationID, 3)

	resp := harness.Do("POST", "/wines/"+strconv.Itoa(wine.ID)+"/consumptions", map[string]interface{}{
		"date": "2026-01-15",
	})
	var created db.Consumption
	harness.JSONResponse(resp, &created)

	resp = harness.Do("DELETE", "/consumptions/"+strconv.Itoa(created.ID), nil)
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("Expected status %d, got %d", http.StatusNoContent, resp.StatusCode)
	}

	resp = harness.Do("GET", "/wines/"+strconv.Itoa(wine.ID), nil)
	var detail db.WineDetail
	harness.JSONResponse(resp, &detail)
	if len(detail.ConsumptionHistory) != 0 {
		t.Errorf("Expected consumption removed from history, got %d entries", len(detail.ConsumptionHistory))
	}
}

func TestConsumptionDeleteRestoresWineQuantity(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Chinon Restore")
	wine := createTestWine(t, harness, appellationID, 3)

	resp := harness.Do("POST", "/wines/"+strconv.Itoa(wine.ID)+"/consumptions", map[string]interface{}{
		"date": "2026-01-15",
	})
	var created db.Consumption
	harness.JSONResponse(resp, &created)

	resp = harness.Do("GET", "/wines/"+strconv.Itoa(wine.ID), nil)
	var afterCreate db.WineDetail
	harness.JSONResponse(resp, &afterCreate)
	if afterCreate.Quantity != 2 {
		t.Fatalf("Expected quantity decremented to 2, got %d", afterCreate.Quantity)
	}

	resp = harness.Do("DELETE", "/consumptions/"+strconv.Itoa(created.ID), nil)
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("Expected status %d, got %d", http.StatusNoContent, resp.StatusCode)
	}

	resp = harness.Do("GET", "/wines/"+strconv.Itoa(wine.ID), nil)
	var afterDelete db.WineDetail
	harness.JSONResponse(resp, &afterDelete)
	if afterDelete.Quantity != 3 {
		t.Errorf("Expected quantity restored to 3, got %d", afterDelete.Quantity)
	}
}

func TestConsumptionDeleteNotFound(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)

	resp := harness.Do("DELETE", "/consumptions/9999", nil)
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "consumption_not_found" {
		t.Errorf("Expected error code 'consumption_not_found', got %q", code)
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
