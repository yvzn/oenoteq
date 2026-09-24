package handlers

import (
	"net/http"
	"strconv"
	"testing"

	"github.com/younited/wine-cellar-tracker/internal/db"
)

func TestMealRename(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	mealID := createTestMeal(t, harness, "Roast Chicken")

	resp := harness.Do("PUT", "/meals/"+strconv.Itoa(mealID), map[string]string{"name": "Grilled Chicken"})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status %d, got %d", http.StatusOK, resp.StatusCode)
	}

	var updated db.Meal
	harness.JSONResponse(resp, &updated)
	if updated.ID != mealID {
		t.Errorf("Expected same id %d, got %d", mealID, updated.ID)
	}
	if updated.Name != "Grilled Chicken" {
		t.Errorf("Expected name 'Grilled Chicken', got %q", updated.Name)
	}

	resp = harness.Do("GET", "/meals", nil)
	var meals []db.Meal
	harness.JSONResponse(resp, &meals)
	if len(meals) != 1 || meals[0].Name != "Grilled Chicken" {
		t.Errorf("Expected persisted renamed meal, got %+v", meals)
	}
}

func TestMealRenameRejectsDuplicate(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	createTestMeal(t, harness, "Oysters")
	mealID := createTestMeal(t, harness, "Grilled Fish")

	resp := harness.Do("PUT", "/meals/"+strconv.Itoa(mealID), map[string]string{"name": "Oysters"})
	if resp.StatusCode != http.StatusConflict {
		t.Errorf("Expected status %d, got %d", http.StatusConflict, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "already_exists" {
		t.Errorf("Expected error code 'already_exists', got %q", code)
	}
}

func TestMealRenameNotFound(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)

	resp := harness.Do("PUT", "/meals/9999", map[string]string{"name": "Ghost Meal"})
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "meal_not_found" {
		t.Errorf("Expected error code 'meal_not_found', got %q", code)
	}
}

func TestMealDelete(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	mealID := createTestMeal(t, harness, "Cheese Plate")

	resp := harness.Do("DELETE", "/meals/"+strconv.Itoa(mealID), nil)
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("Expected status %d, got %d", http.StatusNoContent, resp.StatusCode)
	}

	resp = harness.Do("GET", "/meals", nil)
	var meals []db.Meal
	harness.JSONResponse(resp, &meals)
	if len(meals) != 0 {
		t.Errorf("Expected 0 meals after delete, got %d", len(meals))
	}
}

func TestMealDeleteBlockedWhenReferencedByMealPairing(t *testing.T) {
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

	resp = harness.Do("DELETE", "/meals/"+strconv.Itoa(mealID), nil)
	if resp.StatusCode != http.StatusConflict {
		t.Errorf("Expected status %d, got %d", http.StatusConflict, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "meal_in_use" {
		t.Errorf("Expected error code 'meal_in_use', got %q", code)
	}

	resp = harness.Do("GET", "/meals", nil)
	var meals []db.Meal
	harness.JSONResponse(resp, &meals)
	if len(meals) != 1 {
		t.Errorf("Expected meal to survive blocked delete, got %d meals", len(meals))
	}
}

func TestMealDeleteNotFound(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)

	resp := harness.Do("DELETE", "/meals/9999", nil)
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "meal_not_found" {
		t.Errorf("Expected error code 'meal_not_found', got %q", code)
	}
}
