package handlers

import (
	"net/http"
	"strconv"
	"testing"

	"github.com/younited/wine-cellar-tracker/internal/db"
	"github.com/younited/wine-cellar-tracker/internal/test"
)

func createTestAppellation(t *testing.T, harness *test.Harness, name string) int {
	t.Helper()

	resp := harness.Do("POST", "/appellations", map[string]string{"name": name})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d creating appellation, got %d", http.StatusCreated, resp.StatusCode)
	}

	var appellation db.Appellation
	harness.JSONResponse(resp, &appellation)
	return appellation.ID
}

func TestWineCreateWithMillesime(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Bourgueil")

	millesime := 2018
	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"millesime":      millesime,
		"appellation_id": appellationID,
		"producer":       "Domaine du Closel",
		"color":          "rouge",
		"garde_debut":    2020,
		"garde_fin":      2028,
		"quantity":       6,
	})

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}

	var wine db.Wine
	harness.JSONResponse(resp, &wine)

	if wine.ID == 0 {
		t.Errorf("Expected non-zero ID")
	}
	if wine.Millesime == nil || *wine.Millesime != 2018 {
		t.Errorf("Expected millesime 2018, got %v", wine.Millesime)
	}
	if wine.AppellationID != appellationID {
		t.Errorf("Expected appellation_id %d, got %d", appellationID, wine.AppellationID)
	}
	if wine.Producer != "Domaine du Closel" {
		t.Errorf("Expected producer 'Domaine du Closel', got %q", wine.Producer)
	}
	if wine.Color != "rouge" {
		t.Errorf("Expected color 'rouge', got %q", wine.Color)
	}
	if wine.GardeDebut != 2020 || wine.GardeFin != 2028 {
		t.Errorf("Expected garde 2020-2028, got %d-%d", wine.GardeDebut, wine.GardeFin)
	}
	if wine.Quantity != 6 {
		t.Errorf("Expected quantity 6, got %d", wine.Quantity)
	}
}

func TestWineCreateWithoutMillesime(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Champagne")

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer":       "Maison X",
		"color":          "blanc",
		"garde_debut":    2022,
		"garde_fin":      2030,
		"quantity":       3,
	})

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}

	var wine db.Wine
	harness.JSONResponse(resp, &wine)

	if wine.Millesime != nil {
		t.Errorf("Expected nil millesime, got %v", *wine.Millesime)
	}
}

func TestWineCreateRejectsUnknownAppellation(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": 9999,
		"producer":       "Maison X",
		"color":          "rouge",
		"garde_debut":    2022,
		"garde_fin":      2030,
		"quantity":       3,
	})

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, resp.StatusCode)
	}
}

func TestWineCreateRejectsInvalidColor(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Sancerre")

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer":       "Maison X",
		"color":          "orange",
		"garde_debut":    2022,
		"garde_fin":      2030,
		"quantity":       3,
	})

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, resp.StatusCode)
	}
}

func TestWineCreateRejectsNegativeQuantity(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Chinon")

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer":       "Maison X",
		"color":          "rouge",
		"garde_debut":    2022,
		"garde_fin":      2030,
		"quantity":       -1,
	})

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, resp.StatusCode)
	}
}

func TestWineEditFields(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Vouvray")
	otherAppellationID := createTestAppellation(t, harness, "Saumur")

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer":       "Domaine A",
		"color":          "blanc",
		"garde_debut":    2021,
		"garde_fin":      2029,
		"quantity":       4,
	})
	var created db.Wine
	harness.JSONResponse(resp, &created)

	millesime := 2019
	resp = harness.Do("PUT", "/wines/"+strconv.Itoa(created.ID), map[string]interface{}{
		"millesime":      millesime,
		"appellation_id": otherAppellationID,
		"producer":       "Domaine B",
		"color":          "rose",
		"garde_debut":    2023,
		"garde_fin":      2031,
		"quantity":       2,
	})

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status %d, got %d", http.StatusOK, resp.StatusCode)
	}

	var updated db.Wine
	harness.JSONResponse(resp, &updated)

	if updated.ID != created.ID {
		t.Errorf("Expected same id %d, got %d", created.ID, updated.ID)
	}
	if updated.Millesime == nil || *updated.Millesime != 2019 {
		t.Errorf("Expected millesime 2019, got %v", updated.Millesime)
	}
	if updated.AppellationID != otherAppellationID {
		t.Errorf("Expected appellation_id %d, got %d", otherAppellationID, updated.AppellationID)
	}
	if updated.Producer != "Domaine B" {
		t.Errorf("Expected producer 'Domaine B', got %q", updated.Producer)
	}
	if updated.Color != "rose" {
		t.Errorf("Expected color 'rose', got %q", updated.Color)
	}
	if updated.GardeDebut != 2023 || updated.GardeFin != 2031 {
		t.Errorf("Expected garde 2023-2031, got %d-%d", updated.GardeDebut, updated.GardeFin)
	}
	if updated.Quantity != 2 {
		t.Errorf("Expected quantity 2, got %d", updated.Quantity)
	}

	resp = harness.Do("GET", "/wines/"+strconv.Itoa(created.ID), nil)
	var fetched db.Wine
	harness.JSONResponse(resp, &fetched)
	if fetched.Producer != "Domaine B" {
		t.Errorf("Expected persisted producer 'Domaine B', got %q", fetched.Producer)
	}
}

func TestWineEditRejectsUnknownAppellation(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Menetou-Salon")

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer":       "Domaine A",
		"color":          "blanc",
		"garde_debut":    2021,
		"garde_fin":      2029,
		"quantity":       4,
	})
	var created db.Wine
	harness.JSONResponse(resp, &created)

	resp = harness.Do("PUT", "/wines/"+strconv.Itoa(created.ID), map[string]interface{}{
		"appellation_id": 9999,
		"producer":       "Domaine A",
		"color":          "blanc",
		"garde_debut":    2021,
		"garde_fin":      2029,
		"quantity":       4,
	})

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, resp.StatusCode)
	}
}

func TestWineEditRejectsInvalidColor(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Reuilly")

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer":       "Domaine A",
		"color":          "blanc",
		"garde_debut":    2021,
		"garde_fin":      2029,
		"quantity":       4,
	})
	var created db.Wine
	harness.JSONResponse(resp, &created)

	resp = harness.Do("PUT", "/wines/"+strconv.Itoa(created.ID), map[string]interface{}{
		"appellation_id": appellationID,
		"producer":       "Domaine A",
		"color":          "orange",
		"garde_debut":    2021,
		"garde_fin":      2029,
		"quantity":       4,
	})

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, resp.StatusCode)
	}
}

func TestWineEditRejectsNegativeQuantity(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Quincy")

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer":       "Domaine A",
		"color":          "blanc",
		"garde_debut":    2021,
		"garde_fin":      2029,
		"quantity":       4,
	})
	var created db.Wine
	harness.JSONResponse(resp, &created)

	resp = harness.Do("PUT", "/wines/"+strconv.Itoa(created.ID), map[string]interface{}{
		"appellation_id": appellationID,
		"producer":       "Domaine A",
		"color":          "blanc",
		"garde_debut":    2021,
		"garde_fin":      2029,
		"quantity":       -3,
	})

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, resp.StatusCode)
	}
}

func TestWineEditNotFound(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Cheverny")

	resp := harness.Do("PUT", "/wines/9999", map[string]interface{}{
		"appellation_id": appellationID,
		"producer":       "Domaine A",
		"color":          "blanc",
		"garde_debut":    2021,
		"garde_fin":      2029,
		"quantity":       4,
	})

	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, resp.StatusCode)
	}
}

func TestWineListIncludesZeroQuantity(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Anjou")

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer":       "Domaine A",
		"color":          "blanc",
		"garde_debut":    2021,
		"garde_fin":      2029,
		"quantity":       0,
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}

	resp = harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer":       "Domaine B",
		"color":          "rouge",
		"garde_debut":    2021,
		"garde_fin":      2029,
		"quantity":       5,
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}

	resp = harness.Do("GET", "/wines", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status %d, got %d", http.StatusOK, resp.StatusCode)
	}

	var wines []db.Wine
	harness.JSONResponse(resp, &wines)

	if len(wines) != 2 {
		t.Fatalf("Expected 2 wines, got %d", len(wines))
	}

	foundZero := false
	for _, w := range wines {
		if w.Producer == "Domaine A" && w.Quantity == 0 {
			foundZero = true
		}
	}
	if !foundZero {
		t.Errorf("Expected zero-quantity wine to be present in list")
	}
}

func TestWineGetDetail(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Pouilly-Fume")

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer":       "Domaine C",
		"color":          "blanc",
		"garde_debut":    2022,
		"garde_fin":      2027,
		"quantity":       1,
	})
	var created db.Wine
	harness.JSONResponse(resp, &created)

	resp = harness.Do("GET", "/wines/"+strconv.Itoa(created.ID), nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status %d, got %d", http.StatusOK, resp.StatusCode)
	}

	var fetched db.Wine
	harness.JSONResponse(resp, &fetched)

	if fetched.ID != created.ID {
		t.Errorf("Expected id %d, got %d", created.ID, fetched.ID)
	}
	if fetched.Producer != "Domaine C" {
		t.Errorf("Expected producer 'Domaine C', got %q", fetched.Producer)
	}
	if fetched.AppellationID != appellationID {
		t.Errorf("Expected appellation_id %d, got %d", appellationID, fetched.AppellationID)
	}
}

func TestWineGetDetailNotFound(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)

	resp := harness.Do("GET", "/wines/9999", nil)
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, resp.StatusCode)
	}
}

func TestWineDetailIncludesSuggestedMeals(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Chablis")
	mealA := createTestMeal(t, harness, "Oysters")
	mealB := createTestMeal(t, harness, "Grilled Fish")

	harness.Do("POST", "/meal-pairings", map[string]interface{}{
		"appellation_id": appellationID,
		"color":          "blanc",
		"meal_id":        mealA,
	})
	harness.Do("POST", "/meal-pairings", map[string]interface{}{
		"appellation_id": appellationID,
		"color":          "blanc",
		"meal_id":        mealB,
	})

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer":       "Domaine C",
		"color":          "blanc",
		"garde_debut":    2022,
		"garde_fin":      2027,
		"quantity":       1,
	})
	var created db.Wine
	harness.JSONResponse(resp, &created)

	resp = harness.Do("GET", "/wines/"+strconv.Itoa(created.ID), nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status %d, got %d", http.StatusOK, resp.StatusCode)
	}

	var detail db.WineDetail
	harness.JSONResponse(resp, &detail)

	if len(detail.SuggestedMeals) != 2 {
		t.Fatalf("Expected 2 suggested meals, got %d", len(detail.SuggestedMeals))
	}
	if detail.SuggestedMeals[0].Name != "Grilled Fish" || detail.SuggestedMeals[1].Name != "Oysters" {
		t.Errorf("Expected suggested meals ordered by name, got %q, %q", detail.SuggestedMeals[0].Name, detail.SuggestedMeals[1].Name)
	}
}

func TestWineDetailEmptySuggestedMealsWhenNoPairing(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Morgon")

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer":       "Domaine D",
		"color":          "rouge",
		"garde_debut":    2020,
		"garde_fin":      2026,
		"quantity":       2,
	})
	var created db.Wine
	harness.JSONResponse(resp, &created)

	resp = harness.Do("GET", "/wines/"+strconv.Itoa(created.ID), nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status %d, got %d", http.StatusOK, resp.StatusCode)
	}

	var detail db.WineDetail
	harness.JSONResponse(resp, &detail)

	if detail.SuggestedMeals == nil {
		t.Errorf("Expected suggested_meals to be an empty list, got nil")
	}
	if len(detail.SuggestedMeals) != 0 {
		t.Errorf("Expected 0 suggested meals, got %d", len(detail.SuggestedMeals))
	}
}

func TestWineDetailReflectsMealPairingEdits(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Fleurie")
	mealA := createTestMeal(t, harness, "Charcuterie")

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer":       "Domaine E",
		"color":          "rouge",
		"garde_debut":    2021,
		"garde_fin":      2025,
		"quantity":       3,
	})
	var created db.Wine
	harness.JSONResponse(resp, &created)

	resp = harness.Do("GET", "/wines/"+strconv.Itoa(created.ID), nil)
	var detail db.WineDetail
	harness.JSONResponse(resp, &detail)
	if len(detail.SuggestedMeals) != 0 {
		t.Fatalf("Expected 0 suggested meals before pairing, got %d", len(detail.SuggestedMeals))
	}

	harness.Do("POST", "/meal-pairings", map[string]interface{}{
		"appellation_id": appellationID,
		"color":          "rouge",
		"meal_id":        mealA,
	})

	resp = harness.Do("GET", "/wines/"+strconv.Itoa(created.ID), nil)
	harness.JSONResponse(resp, &detail)
	if len(detail.SuggestedMeals) != 1 {
		t.Fatalf("Expected 1 suggested meal after pairing, got %d", len(detail.SuggestedMeals))
	}
	if detail.SuggestedMeals[0].Name != "Charcuterie" {
		t.Errorf("Expected suggested meal 'Charcuterie', got %q", detail.SuggestedMeals[0].Name)
	}

	harness.Do("DELETE", "/meal-pairings", map[string]interface{}{
		"appellation_id": appellationID,
		"color":          "rouge",
		"meal_id":        mealA,
	})

	resp = harness.Do("GET", "/wines/"+strconv.Itoa(created.ID), nil)
	harness.JSONResponse(resp, &detail)
	if len(detail.SuggestedMeals) != 0 {
		t.Errorf("Expected 0 suggested meals after pairing removed, got %d", len(detail.SuggestedMeals))
	}
}
