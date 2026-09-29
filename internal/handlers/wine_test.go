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

var testProducerCounter int

// uniqueTestProducerName returns a producer name that's unique across the
// test run, since producer names are unique like appellation names.
func uniqueTestProducerName(prefix string) string {
	testProducerCounter++
	return prefix + " " + strconv.Itoa(testProducerCounter)
}

func createTestProducer(t *testing.T, harness *test.Harness, name string) int {
	t.Helper()

	resp := harness.Do("POST", "/producers", map[string]string{"name": name})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d creating producer, got %d", http.StatusCreated, resp.StatusCode)
	}

	var producer db.Producer
	harness.JSONResponse(resp, &producer)
	return producer.ID
}

// applyQuantityAdjustment applies a manual signed delta to a Wine's quantity
// via the quantity-adjustments endpoint and returns the updated Wine.
func applyQuantityAdjustment(t *testing.T, harness *test.Harness, wineID, delta int) db.Wine {
	t.Helper()

	resp := harness.Do("POST", "/wines/"+strconv.Itoa(wineID)+"/quantity-adjustments", map[string]interface{}{
		"delta": delta,
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d applying quantity adjustment, got %d", http.StatusCreated, resp.StatusCode)
	}

	var wine db.Wine
	harness.JSONResponse(resp, &wine)
	return wine
}

func TestWineCreateWithMillesime(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Bourgueil")
	producerID := createTestProducer(t, harness, "Domaine du Closel")

	millesime := 2018
	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"millesime":      millesime,
		"appellation_id": appellationID,
		"producer_id":    producerID,
		"color":          "rouge",
		"garde_debut":    2020,
		"garde_fin":      2028,
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
	if wine.ProducerID != producerID {
		t.Errorf("Expected producer_id %d, got %d", producerID, wine.ProducerID)
	}
	if wine.Producer.Name != "Domaine du Closel" {
		t.Errorf("Expected producer name 'Domaine du Closel', got %q", wine.Producer.Name)
	}
	if wine.Color != "rouge" {
		t.Errorf("Expected color 'rouge', got %q", wine.Color)
	}
	if wine.GardeDebut == nil || *wine.GardeDebut != 2020 || wine.GardeFin == nil || *wine.GardeFin != 2028 {
		t.Errorf("Expected garde 2020-2028, got %v-%v", wine.GardeDebut, wine.GardeFin)
	}
	if wine.Quantity != 0 {
		t.Errorf("Expected quantity to start at 0, got %d", wine.Quantity)
	}
}

func TestWineCreateIgnoresQuantityField(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Bourgueil Ignored")
	producerID := createTestProducer(t, harness, "Domaine Ignored")

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer_id":    producerID,
		"color":          "rouge",
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}

	var wine db.Wine
	harness.JSONResponse(resp, &wine)
	if wine.Quantity != 0 {
		t.Errorf("Expected quantity field in create body to have no effect, got %d", wine.Quantity)
	}
}

func TestWineCreateIdempotentByClientID(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Bourgueil")
	producerID := createTestProducer(t, harness, uniqueTestProducerName("Domaine Test"))

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer_id":    producerID,
		"color":          "rouge",
		"garde_debut":    2020,
		"garde_fin":      2028,
		"client_id":      "client-abc",
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}
	var first db.Wine
	harness.JSONResponse(resp, &first)

	resp = harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer_id":    producerID,
		"color":          "rouge",
		"garde_debut":    2020,
		"garde_fin":      2028,
		"client_id":      "client-abc",
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d on retry, got %d", http.StatusCreated, resp.StatusCode)
	}
	var retried db.Wine
	harness.JSONResponse(resp, &retried)
	if retried.ID != first.ID {
		t.Errorf("Expected retried create to return original id %d, got %d", first.ID, retried.ID)
	}

	resp = harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer_id":    producerID,
		"color":          "blanc",
		"garde_debut":    2021,
		"garde_fin":      2029,
		"client_id":      "client-def",
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}
	var second db.Wine
	harness.JSONResponse(resp, &second)
	if second.ID == first.ID {
		t.Errorf("Expected distinct id for different client_id, got same id %d", second.ID)
	}

	resp = harness.Do("GET", "/wines", nil)
	var wines []db.Wine
	harness.JSONResponse(resp, &wines)
	if len(wines) != 2 {
		t.Errorf("Expected 2 wines, got %d", len(wines))
	}
}

func TestWineCreateWithoutMillesime(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Champagne")
	producerID := createTestProducer(t, harness, "Maison X")

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer_id":    producerID,
		"color":          "blanc",
		"garde_debut":    2022,
		"garde_fin":      2030,
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

func TestWineCreateWithoutGarde(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Muscadet")
	producerID := createTestProducer(t, harness, "Domaine C")

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer_id":    producerID,
		"color":          "blanc",
	})

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}

	var wine db.Wine
	harness.JSONResponse(resp, &wine)

	if wine.GardeDebut != nil {
		t.Errorf("Expected nil garde_debut, got %v", *wine.GardeDebut)
	}
	if wine.GardeFin != nil {
		t.Errorf("Expected nil garde_fin, got %v", *wine.GardeFin)
	}
}

func TestWineCreateWithOnlyGardeDebut(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Savennieres")
	producerID := createTestProducer(t, harness, "Domaine D")

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer_id":    producerID,
		"color":          "blanc",
		"garde_debut":    2025,
	})

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}

	var wine db.Wine
	harness.JSONResponse(resp, &wine)

	if wine.GardeDebut == nil || *wine.GardeDebut != 2025 {
		t.Errorf("Expected garde_debut 2025, got %v", wine.GardeDebut)
	}
	if wine.GardeFin != nil {
		t.Errorf("Expected nil garde_fin, got %v", *wine.GardeFin)
	}
}

func TestWineCreateRejectsUnknownAppellation(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": 9999,
		"producer_id":    0,
		"color":          "rouge",
		"garde_debut":    2022,
		"garde_fin":      2030,
	})

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "appellation_not_found" {
		t.Errorf("Expected error code 'appellation_not_found', got %q", code)
	}
}

func TestWineCreateRejectsInvalidColor(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Sancerre")

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer_id":    0,
		"color":          "orange",
		"garde_debut":    2022,
		"garde_fin":      2030,
	})

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "invalid_color" {
		t.Errorf("Expected error code 'invalid_color', got %q", code)
	}
}

func TestWineEditFields(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Vouvray")
	otherAppellationID := createTestAppellation(t, harness, "Saumur")
	producerID := createTestProducer(t, harness, "Domaine A")
	otherProducerID := createTestProducer(t, harness, "Domaine B")

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer_id":    producerID,
		"color":          "blanc",
		"garde_debut":    2021,
		"garde_fin":      2029,
	})
	var created db.Wine
	harness.JSONResponse(resp, &created)

	millesime := 2019
	resp = harness.Do("PUT", "/wines/"+strconv.Itoa(created.ID), map[string]interface{}{
		"millesime":      millesime,
		"appellation_id": otherAppellationID,
		"producer_id":    otherProducerID,
		"color":          "rose",
		"garde_debut":    2023,
		"garde_fin":      2031,
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
	if updated.ProducerID != otherProducerID {
		t.Errorf("Expected producer_id %d, got %d", otherProducerID, updated.ProducerID)
	}
	if updated.Producer.Name != "Domaine B" {
		t.Errorf("Expected producer name 'Domaine B', got %q", updated.Producer.Name)
	}
	if updated.Color != "rose" {
		t.Errorf("Expected color 'rose', got %q", updated.Color)
	}
	if updated.GardeDebut == nil || *updated.GardeDebut != 2023 || updated.GardeFin == nil || *updated.GardeFin != 2031 {
		t.Errorf("Expected garde 2023-2031, got %v-%v", updated.GardeDebut, updated.GardeFin)
	}

	resp = harness.Do("GET", "/wines/"+strconv.Itoa(created.ID), nil)
	var fetched db.Wine
	harness.JSONResponse(resp, &fetched)
	if fetched.Producer.Name != "Domaine B" {
		t.Errorf("Expected persisted producer name 'Domaine B', got %q", fetched.Producer.Name)
	}
}

func TestWineEditIgnoresQuantityField(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Vouvray Ignored")
	producerID := createTestProducer(t, harness, "Domaine Ignored Edit")

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer_id":    producerID,
		"color":          "blanc",
	})
	var created db.Wine
	harness.JSONResponse(resp, &created)
	applyQuantityAdjustment(t, harness, created.ID, 4)

	resp = harness.Do("PUT", "/wines/"+strconv.Itoa(created.ID), map[string]interface{}{
		"appellation_id": appellationID,
		"producer_id":    producerID,
		"color":          "blanc",
		"quantity":       9999,
	})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status %d, got %d", http.StatusOK, resp.StatusCode)
	}

	var updated db.Wine
	harness.JSONResponse(resp, &updated)
	if updated.Quantity != 4 {
		t.Errorf("Expected quantity field in edit body to have no effect, quantity should remain 4, got %d", updated.Quantity)
	}
}

func TestWineEditRejectsUnknownAppellation(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Menetou-Salon")
	producerID := createTestProducer(t, harness, "Domaine A")

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer_id":    producerID,
		"color":          "blanc",
		"garde_debut":    2021,
		"garde_fin":      2029,
	})
	var created db.Wine
	harness.JSONResponse(resp, &created)

	resp = harness.Do("PUT", "/wines/"+strconv.Itoa(created.ID), map[string]interface{}{
		"appellation_id": 9999,
		"producer_id":    producerID,
		"color":          "blanc",
		"garde_debut":    2021,
		"garde_fin":      2029,
	})

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "appellation_not_found" {
		t.Errorf("Expected error code 'appellation_not_found', got %q", code)
	}
}

func TestWineEditRejectsInvalidColor(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Reuilly")
	producerID := createTestProducer(t, harness, "Domaine A")

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer_id":    producerID,
		"color":          "blanc",
		"garde_debut":    2021,
		"garde_fin":      2029,
	})
	var created db.Wine
	harness.JSONResponse(resp, &created)

	resp = harness.Do("PUT", "/wines/"+strconv.Itoa(created.ID), map[string]interface{}{
		"appellation_id": appellationID,
		"producer_id":    producerID,
		"color":          "orange",
		"garde_debut":    2021,
		"garde_fin":      2029,
	})

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "invalid_color" {
		t.Errorf("Expected error code 'invalid_color', got %q", code)
	}
}

func TestWineEditNotFound(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Cheverny")
	producerID := createTestProducer(t, harness, "Domaine A")

	resp := harness.Do("PUT", "/wines/9999", map[string]interface{}{
		"appellation_id": appellationID,
		"producer_id":    producerID,
		"color":          "blanc",
		"garde_debut":    2021,
		"garde_fin":      2029,
	})

	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Expected status %d, got %d", http.StatusNotFound, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "wine_not_found" {
		t.Errorf("Expected error code 'wine_not_found', got %q", code)
	}
}

func TestWineListIncludesZeroQuantity(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Anjou")
	producerID := createTestProducer(t, harness, "Domaine A")
	otherProducerID := createTestProducer(t, harness, "Domaine B")

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer_id":    producerID,
		"color":          "blanc",
		"garde_debut":    2021,
		"garde_fin":      2029,
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}

	resp = harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer_id":    otherProducerID,
		"color":          "rouge",
		"garde_debut":    2021,
		"garde_fin":      2029,
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}
	var stocked db.Wine
	harness.JSONResponse(resp, &stocked)
	applyQuantityAdjustment(t, harness, stocked.ID, 5)

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
		if w.Producer.Name == "Domaine A" && w.Quantity == 0 {
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
	producerID := createTestProducer(t, harness, "Domaine C")

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer_id":    producerID,
		"color":          "blanc",
		"garde_debut":    2022,
		"garde_fin":      2027,
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
	if fetched.Producer.Name != "Domaine C" {
		t.Errorf("Expected producer name 'Domaine C', got %q", fetched.Producer.Name)
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
	if code := harness.ErrorCode(resp); code != "wine_not_found" {
		t.Errorf("Expected error code 'wine_not_found', got %q", code)
	}
}

func TestWineDetailIncludesSuggestedMeals(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Chablis")
	producerID := createTestProducer(t, harness, "Domaine C")
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
		"producer_id":    producerID,
		"color":          "blanc",
		"garde_debut":    2022,
		"garde_fin":      2027,
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
	producerID := createTestProducer(t, harness, "Domaine D")

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer_id":    producerID,
		"color":          "rouge",
		"garde_debut":    2020,
		"garde_fin":      2026,
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
	producerID := createTestProducer(t, harness, "Domaine E")
	mealA := createTestMeal(t, harness, "Charcuterie")

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer_id":    producerID,
		"color":          "rouge",
		"garde_debut":    2021,
		"garde_fin":      2025,
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
