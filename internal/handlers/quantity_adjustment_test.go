package handlers

import (
	"net/http"
	"strconv"
	"testing"

	"github.com/younited/wine-cellar-tracker/internal/db"
)

func TestQuantityAdjustmentApplies(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Bandol Adjustment")
	wine := createTestWine(t, harness, appellationID, 2)

	resp := harness.Do("POST", "/wines/"+strconv.Itoa(wine.ID)+"/quantity-adjustments", map[string]interface{}{
		"delta": 3,
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}

	var updated db.Wine
	harness.JSONResponse(resp, &updated)
	if updated.Quantity != 5 {
		t.Errorf("Expected quantity 5 after +3 adjustment on stock of 2, got %d", updated.Quantity)
	}

	resp = harness.Do("POST", "/wines/"+strconv.Itoa(wine.ID)+"/quantity-adjustments", map[string]interface{}{
		"delta": -4,
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}
	harness.JSONResponse(resp, &updated)
	if updated.Quantity != 1 {
		t.Errorf("Expected quantity 1 after -4 adjustment on stock of 5, got %d", updated.Quantity)
	}
}

func TestQuantityAdjustmentRejectsDeltaBelowZero(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Bandol Reject")
	wine := createTestWine(t, harness, appellationID, 2)

	resp := harness.Do("POST", "/wines/"+strconv.Itoa(wine.ID)+"/quantity-adjustments", map[string]interface{}{
		"delta": -3,
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
	if detail.Quantity != 2 {
		t.Errorf("Expected quantity to remain unchanged at 2, got %d", detail.Quantity)
	}
}

func TestQuantityAdjustmentIdempotentByClientID(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Bandol Idempotent")
	wine := createTestWine(t, harness, appellationID, 2)

	resp := harness.Do("POST", "/wines/"+strconv.Itoa(wine.ID)+"/quantity-adjustments", map[string]interface{}{
		"delta":     3,
		"client_id": "adj-abc",
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}
	var first db.Wine
	harness.JSONResponse(resp, &first)
	if first.Quantity != 5 {
		t.Fatalf("Expected quantity 5, got %d", first.Quantity)
	}

	resp = harness.Do("POST", "/wines/"+strconv.Itoa(wine.ID)+"/quantity-adjustments", map[string]interface{}{
		"delta":     3,
		"client_id": "adj-abc",
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d on retry, got %d", http.StatusCreated, resp.StatusCode)
	}
	var retried db.Wine
	harness.JSONResponse(resp, &retried)
	if retried.Quantity != 5 {
		t.Errorf("Expected retried adjustment to not double-apply, quantity should stay 5, got %d", retried.Quantity)
	}
}

func TestQuantityAdjustmentForUnknownWine(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)

	resp := harness.Do("POST", "/wines/9999/quantity-adjustments", map[string]interface{}{
		"delta": 1,
	})
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "wine_not_found" {
		t.Errorf("Expected error code 'wine_not_found', got %q", code)
	}
}
