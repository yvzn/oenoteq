package handlers

import (
	"net/http"
	"strconv"
	"testing"

	"github.com/younited/wine-cellar-tracker/internal/db"
	"github.com/younited/wine-cellar-tracker/internal/test"
)

func createTestMeal(t *testing.T, harness *test.Harness, name string) int {
	t.Helper()

	resp := harness.Do("POST", "/meals", map[string]string{"name": name})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d creating meal, got %d", http.StatusCreated, resp.StatusCode)
	}

	var meal db.Meal
	harness.JSONResponse(resp, &meal)
	return meal.ID
}

func listMealPairing(t *testing.T, harness *test.Harness, appellationID int, color string) []db.Meal {
	t.Helper()

	resp := harness.Do("GET", "/meal-pairings?appellation_id="+strconv.Itoa(appellationID)+"&color="+color, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status %d listing meal pairing, got %d", http.StatusOK, resp.StatusCode)
	}

	var meals []db.Meal
	harness.JSONResponse(resp, &meals)
	return meals
}

func TestMealPairingAssociateAndList(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Chablis")
	mealA := createTestMeal(t, harness, "Oysters")
	mealB := createTestMeal(t, harness, "Grilled Fish")

	resp := harness.Do("POST", "/meal-pairings", map[string]interface{}{
		"appellation_id": appellationID,
		"color":          "blanc",
		"meal_id":        mealA,
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}

	resp = harness.Do("POST", "/meal-pairings", map[string]interface{}{
		"appellation_id": appellationID,
		"color":          "blanc",
		"meal_id":        mealB,
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}

	meals := listMealPairing(t, harness, appellationID, "blanc")
	if len(meals) != 2 {
		t.Fatalf("Expected 2 meals, got %d", len(meals))
	}
	if meals[0].Name != "Grilled Fish" || meals[1].Name != "Oysters" {
		t.Errorf("Expected meals ordered by name, got %q, %q", meals[0].Name, meals[1].Name)
	}
}

func TestMealPairingListEmptyForUnpairedColor(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Sancerre")
	mealID := createTestMeal(t, harness, "Goat Cheese")

	resp := harness.Do("POST", "/meal-pairings", map[string]interface{}{
		"appellation_id": appellationID,
		"color":          "blanc",
		"meal_id":        mealID,
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}

	meals := listMealPairing(t, harness, appellationID, "rouge")
	if len(meals) != 0 {
		t.Errorf("Expected 0 meals for unpaired color, got %d", len(meals))
	}
}

func TestMealPairingRemove(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Pommard")
	mealA := createTestMeal(t, harness, "Duck Breast")
	mealB := createTestMeal(t, harness, "Beef Stew")

	harness.Do("POST", "/meal-pairings", map[string]interface{}{
		"appellation_id": appellationID,
		"color":          "rouge",
		"meal_id":        mealA,
	})
	harness.Do("POST", "/meal-pairings", map[string]interface{}{
		"appellation_id": appellationID,
		"color":          "rouge",
		"meal_id":        mealB,
	})

	resp := harness.Do("DELETE", "/meal-pairings", map[string]interface{}{
		"appellation_id": appellationID,
		"color":          "rouge",
		"meal_id":        mealA,
	})
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("Expected status %d, got %d", http.StatusNoContent, resp.StatusCode)
	}

	meals := listMealPairing(t, harness, appellationID, "rouge")
	if len(meals) != 1 {
		t.Fatalf("Expected 1 meal remaining, got %d", len(meals))
	}
	if meals[0].Name != "Beef Stew" {
		t.Errorf("Expected remaining meal 'Beef Stew', got %q", meals[0].Name)
	}
}

func TestMealPairingRejectsUnknownAppellation(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	mealID := createTestMeal(t, harness, "Roast Chicken")

	resp := harness.Do("POST", "/meal-pairings", map[string]interface{}{
		"appellation_id": 9999,
		"color":          "blanc",
		"meal_id":        mealID,
	})
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "appellation_not_found" {
		t.Errorf("Expected error code 'appellation_not_found', got %q", code)
	}
}

func TestMealPairingRejectsInvalidColor(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Vouvray")
	mealID := createTestMeal(t, harness, "Roast Chicken")

	resp := harness.Do("POST", "/meal-pairings", map[string]interface{}{
		"appellation_id": appellationID,
		"color":          "orange",
		"meal_id":        mealID,
	})
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "invalid_color" {
		t.Errorf("Expected error code 'invalid_color', got %q", code)
	}
}

func TestMealPairingRejectsUnknownMeal(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Meursault")

	resp := harness.Do("POST", "/meal-pairings", map[string]interface{}{
		"appellation_id": appellationID,
		"color":          "blanc",
		"meal_id":        9999,
	})
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "meal_not_found" {
		t.Errorf("Expected error code 'meal_not_found', got %q", code)
	}
}

func TestMealPairingRemoveRejectsUnknownAppellation(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	mealID := createTestMeal(t, harness, "Roast Chicken")

	resp := harness.Do("DELETE", "/meal-pairings", map[string]interface{}{
		"appellation_id": 9999,
		"color":          "blanc",
		"meal_id":        mealID,
	})
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "appellation_not_found" {
		t.Errorf("Expected error code 'appellation_not_found', got %q", code)
	}
}

func TestMealPairingRemoveRejectsInvalidColor(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Rully")
	mealID := createTestMeal(t, harness, "Roast Chicken")

	resp := harness.Do("DELETE", "/meal-pairings", map[string]interface{}{
		"appellation_id": appellationID,
		"color":          "orange",
		"meal_id":        mealID,
	})
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "invalid_color" {
		t.Errorf("Expected error code 'invalid_color', got %q", code)
	}
}

func TestMealPairingRemoveRejectsUnknownMeal(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Fixin")

	resp := harness.Do("DELETE", "/meal-pairings", map[string]interface{}{
		"appellation_id": appellationID,
		"color":          "rouge",
		"meal_id":        9999,
	})
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "meal_not_found" {
		t.Errorf("Expected error code 'meal_not_found', got %q", code)
	}
}

func TestMealPairingAssociateIsIdempotent(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Volnay")
	mealID := createTestMeal(t, harness, "Duck Confit")

	for i := 0; i < 2; i++ {
		resp := harness.Do("POST", "/meal-pairings", map[string]interface{}{
			"appellation_id": appellationID,
			"color":          "rouge",
			"meal_id":        mealID,
		})
		if resp.StatusCode != http.StatusCreated {
			t.Fatalf("Expected status %d on attempt %d, got %d", http.StatusCreated, i, resp.StatusCode)
		}
	}

	meals := listMealPairing(t, harness, appellationID, "rouge")
	if len(meals) != 1 {
		t.Errorf("Expected re-associating the same meal to stay a single entry, got %d", len(meals))
	}
}

func listAllMealPairings(t *testing.T, harness *test.Harness) []db.MealPairing {
	t.Helper()

	resp := harness.Do("GET", "/meal-pairings/all", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status %d listing all meal pairings, got %d", http.StatusOK, resp.StatusCode)
	}

	var pairings []db.MealPairing
	harness.JSONResponse(resp, &pairings)
	return pairings
}

func TestMealPairingListAllReturnsEveryEdge(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	chablis := createTestAppellation(t, harness, "Chablis")
	pommard := createTestAppellation(t, harness, "Pommard")
	oysters := createTestMeal(t, harness, "Oysters")
	beef := createTestMeal(t, harness, "Beef")

	edges := []mealPairingRequest{
		{AppellationID: chablis, Color: "blanc", MealID: oysters},
		{AppellationID: pommard, Color: "rouge", MealID: beef},
		{AppellationID: pommard, Color: "rouge", MealID: oysters},
	}
	for _, edge := range edges {
		resp := harness.Do("POST", "/meal-pairings", edge)
		if resp.StatusCode != http.StatusCreated {
			t.Fatalf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
		}
	}

	pairings := listAllMealPairings(t, harness)

	if len(pairings) != len(edges) {
		t.Fatalf("Expected %d pairings, got %d", len(edges), len(pairings))
	}
	for _, edge := range edges {
		found := false
		for _, p := range pairings {
			if p.AppellationID == edge.AppellationID && p.Color == edge.Color && p.MealID == edge.MealID {
				found = true
			}
		}
		if !found {
			t.Errorf("Expected pairing %+v in bulk response", edge)
		}
	}
}

func TestMealPairingListAllEmptyReturnsEmptyList(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)

	resp := harness.Do("GET", "/meal-pairings/all", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status %d, got %d", http.StatusOK, resp.StatusCode)
	}

	var raw []interface{}
	harness.JSONResponse(resp, &raw)
	if raw == nil || len(raw) != 0 {
		t.Errorf("Expected empty non-null list, got %v", raw)
	}
}

func TestMealPairingListAllConsistentWithPerCombinationRead(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	chablis := createTestAppellation(t, harness, "Chablis")
	oysters := createTestMeal(t, harness, "Oysters")
	fish := createTestMeal(t, harness, "Grilled Fish")
	for _, meal := range []int{oysters, fish} {
		harness.Do("POST", "/meal-pairings", mealPairingRequest{AppellationID: chablis, Color: "blanc", MealID: meal})
	}

	bulk := map[int]bool{}
	for _, p := range listAllMealPairings(t, harness) {
		if p.AppellationID == chablis && p.Color == "blanc" {
			bulk[p.MealID] = true
		}
	}

	perCombination := listMealPairing(t, harness, chablis, "blanc")
	if len(bulk) != len(perCombination) {
		t.Fatalf("Expected bulk and per-combination reads to agree, got %d vs %d", len(bulk), len(perCombination))
	}
	for _, meal := range perCombination {
		if !bulk[meal.ID] {
			t.Errorf("Meal %d in per-combination read missing from bulk read", meal.ID)
		}
	}
}
