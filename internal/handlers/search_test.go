package handlers

import (
	"net/http"
	"strconv"
	"testing"
	"time"

	"github.com/younited/wine-cellar-tracker/internal/db"
	"github.com/younited/wine-cellar-tracker/internal/test"
)

func createSearchTestWine(t *testing.T, harness *test.Harness, appellationID int, color string, gardeDebut, gardeFin, quantity int) db.Wine {
	t.Helper()

	producerID := createTestProducer(t, harness, uniqueTestProducerName("Test Producer"))

	resp := harness.Do("POST", "/wines", map[string]interface{}{
		"appellation_id": appellationID,
		"producer_id":    producerID,
		"color":          color,
		"garde_debut":    gardeDebut,
		"garde_fin":      gardeFin,
		"quantity":       quantity,
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d creating wine, got %d", http.StatusCreated, resp.StatusCode)
	}

	var wine db.Wine
	harness.JSONResponse(resp, &wine)
	return wine
}

func createSearchTestWineWithOptionalGarde(t *testing.T, harness *test.Harness, appellationID int, color string, gardeDebut, gardeFin *int, quantity int) db.Wine {
	t.Helper()

	producerID := createTestProducer(t, harness, uniqueTestProducerName("Test Producer"))

	body := map[string]interface{}{
		"appellation_id": appellationID,
		"producer_id":    producerID,
		"color":          color,
		"quantity":       quantity,
	}
	if gardeDebut != nil {
		body["garde_debut"] = *gardeDebut
	}
	if gardeFin != nil {
		body["garde_fin"] = *gardeFin
	}

	resp := harness.Do("POST", "/wines", body)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d creating wine, got %d", http.StatusCreated, resp.StatusCode)
	}

	var wine db.Wine
	harness.JSONResponse(resp, &wine)
	return wine
}

func doSearch(t *testing.T, harness *test.Harness, query string) []db.WineSearchResult {
	t.Helper()

	resp := harness.Do("GET", "/search"+query, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status %d searching %q, got %d", http.StatusOK, query, resp.StatusCode)
	}

	var results []db.WineSearchResult
	harness.JSONResponse(resp, &results)
	return results
}

func containsWineID(results []db.WineSearchResult, id int) bool {
	for _, r := range results {
		if r.ID == id {
			return true
		}
	}
	return false
}

func TestSearchByAppellationAlone(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	year := time.Now().Year()
	appellationA := createTestAppellation(t, harness, "Chablis")
	appellationB := createTestAppellation(t, harness, "Sancerre")

	wineA := createSearchTestWine(t, harness, appellationA, "blanc", year-2, year+2, 3)
	createSearchTestWine(t, harness, appellationB, "blanc", year-2, year+2, 3)

	results := doSearch(t, harness, "?appellation_id="+itoa(appellationA))

	if len(results) != 1 {
		t.Fatalf("Expected 1 result, got %d", len(results))
	}
	if !containsWineID(results, wineA.ID) {
		t.Errorf("Expected result to include wine from appellation A")
	}
}

func TestSearchByMealFiltersToPairedAppellationColor(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	year := time.Now().Year()
	appellation := createTestAppellation(t, harness, "Chablis")
	otherAppellation := createTestAppellation(t, harness, "Pommard")
	meal := createTestMeal(t, harness, "Oysters")

	harness.Do("POST", "/meal-pairings", map[string]interface{}{
		"appellation_id": appellation,
		"color":          "blanc",
		"meal_id":        meal,
	})

	paired := createSearchTestWine(t, harness, appellation, "blanc", year-2, year+2, 3)
	createSearchTestWine(t, harness, appellation, "rouge", year-2, year+2, 3)
	createSearchTestWine(t, harness, otherAppellation, "blanc", year-2, year+2, 3)

	results := doSearch(t, harness, "?meal_id="+itoa(meal))

	if len(results) != 1 {
		t.Fatalf("Expected 1 result, got %d", len(results))
	}
	if !containsWineID(results, paired.ID) {
		t.Errorf("Expected result to include wine paired via appellation+color")
	}
}

func TestSearchByReadyNowAlone(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	year := time.Now().Year()
	appellation := createTestAppellation(t, harness, "Chinon")

	ready := createSearchTestWine(t, harness, appellation, "rouge", year-2, year+2, 3)
	tooYoung := createSearchTestWine(t, harness, appellation, "rouge", year+5, year+10, 3)
	pastPeak := createSearchTestWine(t, harness, appellation, "rouge", year-10, year-1, 3)

	results := doSearch(t, harness, "?ready_now=true")

	if len(results) != 1 {
		t.Fatalf("Expected 1 result, got %d", len(results))
	}
	if !containsWineID(results, ready.ID) {
		t.Errorf("Expected ready wine to be included")
	}
	if containsWineID(results, tooYoung.ID) || containsWineID(results, pastPeak.ID) {
		t.Errorf("Expected too_young/past_peak wines to be excluded when ready_now is set")
	}
}

func TestSearchWithoutReadyNowIncludesFlaggedResults(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	year := time.Now().Year()
	appellation := createTestAppellation(t, harness, "Chinon")

	ready := createSearchTestWine(t, harness, appellation, "rouge", year-2, year+2, 3)
	tooYoung := createSearchTestWine(t, harness, appellation, "rouge", year+5, year+10, 3)
	pastPeak := createSearchTestWine(t, harness, appellation, "rouge", year-10, year-1, 3)

	results := doSearch(t, harness, "?appellation_id="+itoa(appellation))

	if len(results) != 3 {
		t.Fatalf("Expected 3 results, got %d", len(results))
	}

	statuses := map[int]string{}
	for _, r := range results {
		statuses[r.ID] = r.GardeStatus
	}
	if statuses[ready.ID] != "ready" {
		t.Errorf("Expected ready status, got %q", statuses[ready.ID])
	}
	if statuses[tooYoung.ID] != "too_young" {
		t.Errorf("Expected too_young status, got %q", statuses[tooYoung.ID])
	}
	if statuses[pastPeak.ID] != "past_peak" {
		t.Errorf("Expected past_peak status, got %q", statuses[pastPeak.ID])
	}
}

func TestSearchGardeStatusWithPartialOrMissingBounds(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	year := time.Now().Year()
	appellation := createTestAppellation(t, harness, "Bandol")

	past := year - 1
	future := year + 1

	unassessed := createSearchTestWineWithOptionalGarde(t, harness, appellation, "rouge", nil, nil, 3)
	startOnlyTooYoung := createSearchTestWineWithOptionalGarde(t, harness, appellation, "rouge", &future, nil, 3)
	startOnlyReady := createSearchTestWineWithOptionalGarde(t, harness, appellation, "rouge", &past, nil, 3)
	endOnlyReady := createSearchTestWineWithOptionalGarde(t, harness, appellation, "rouge", nil, &future, 3)
	endOnlyPastPeak := createSearchTestWineWithOptionalGarde(t, harness, appellation, "rouge", nil, &past, 3)

	results := doSearch(t, harness, "?appellation_id="+itoa(appellation))

	statuses := map[int]string{}
	for _, r := range results {
		statuses[r.ID] = r.GardeStatus
	}
	if statuses[unassessed.ID] != "unassessed" {
		t.Errorf("Expected unassessed status for wine with no garde bounds, got %q", statuses[unassessed.ID])
	}
	if statuses[startOnlyTooYoung.ID] != "too_young" {
		t.Errorf("Expected too_young for future start bound with no end, got %q", statuses[startOnlyTooYoung.ID])
	}
	if statuses[startOnlyReady.ID] != "ready" {
		t.Errorf("Expected ready for past start bound with no end, got %q", statuses[startOnlyReady.ID])
	}
	if statuses[endOnlyReady.ID] != "ready" {
		t.Errorf("Expected ready for future end bound with no start, got %q", statuses[endOnlyReady.ID])
	}
	if statuses[endOnlyPastPeak.ID] != "past_peak" {
		t.Errorf("Expected past_peak for past end bound with no start, got %q", statuses[endOnlyPastPeak.ID])
	}
}

func TestSearchReadyNowExcludesUnassessed(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellation := createTestAppellation(t, harness, "Cahors")

	unassessed := createSearchTestWineWithOptionalGarde(t, harness, appellation, "rouge", nil, nil, 3)

	results := doSearch(t, harness, "?ready_now=true")

	if containsWineID(results, unassessed.ID) {
		t.Errorf("Expected unassessed wine to be excluded from ready_now results")
	}
}

func TestSearchCombinesFiltersWithAND(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	year := time.Now().Year()
	appellationA := createTestAppellation(t, harness, "Chablis")
	appellationB := createTestAppellation(t, harness, "Sancerre")

	matching := createSearchTestWine(t, harness, appellationA, "blanc", year-2, year+2, 3)
	createSearchTestWine(t, harness, appellationA, "blanc", year+5, year+10, 3)
	createSearchTestWine(t, harness, appellationB, "blanc", year-2, year+2, 3)

	results := doSearch(t, harness, "?appellation_id="+itoa(appellationA)+"&ready_now=true")

	if len(results) != 1 {
		t.Fatalf("Expected 1 result, got %d", len(results))
	}
	if !containsWineID(results, matching.ID) {
		t.Errorf("Expected only the appellation+ready_now match to be returned")
	}
}

func TestSearchCombinesMealWithReadyNowAndColor(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	year := time.Now().Year()
	appellation := createTestAppellation(t, harness, "Chablis")
	meal := createTestMeal(t, harness, "Oysters")

	harness.Do("POST", "/meal-pairings", map[string]interface{}{
		"appellation_id": appellation,
		"color":          "blanc",
		"meal_id":        meal,
	})

	matching := createSearchTestWine(t, harness, appellation, "blanc", year-2, year+2, 3)
	pairedButTooYoung := createSearchTestWine(t, harness, appellation, "blanc", year+5, year+10, 3)
	readyButNotPaired := createSearchTestWine(t, harness, appellation, "rouge", year-2, year+2, 3)

	results := doSearch(t, harness, "?meal_id="+itoa(meal)+"&color=blanc&ready_now=true")

	if len(results) != 1 {
		t.Fatalf("Expected 1 result, got %d", len(results))
	}
	if !containsWineID(results, matching.ID) {
		t.Errorf("Expected only the meal+color+ready_now match to be returned")
	}
	if containsWineID(results, pairedButTooYoung.ID) {
		t.Errorf("Expected too_young paired wine to be excluded when ready_now is set")
	}
	if containsWineID(results, readyButNotPaired.ID) {
		t.Errorf("Expected wine with unpaired color to be excluded despite being ready")
	}
}

func TestSearchExcludesZeroQuantityByDefault(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	year := time.Now().Year()
	appellation := createTestAppellation(t, harness, "Volnay")

	inStock := createSearchTestWine(t, harness, appellation, "rouge", year-2, year+2, 3)
	outOfStock := createSearchTestWine(t, harness, appellation, "rouge", year-2, year+2, 0)

	results := doSearch(t, harness, "?appellation_id="+itoa(appellation))

	if !containsWineID(results, inStock.ID) {
		t.Errorf("Expected in-stock wine to be included")
	}
	if containsWineID(results, outOfStock.ID) {
		t.Errorf("Expected zero-quantity wine to be excluded")
	}
}

func TestSearchByColorAlone(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	year := time.Now().Year()
	appellation := createTestAppellation(t, harness, "Anjou")

	rouge := createSearchTestWine(t, harness, appellation, "rouge", year-2, year+2, 3)
	blanc := createSearchTestWine(t, harness, appellation, "blanc", year-2, year+2, 3)

	results := doSearch(t, harness, "?color=rouge")

	if !containsWineID(results, rouge.ID) {
		t.Errorf("Expected rouge wine to be included")
	}
	if containsWineID(results, blanc.ID) {
		t.Errorf("Expected blanc wine to be excluded")
	}
}

func TestSearchRejectsInvalidColor(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)

	resp := harness.Do("GET", "/search?color=orange", nil)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "invalid_color" {
		t.Errorf("Expected error code 'invalid_color', got %q", code)
	}
}

func itoa(n int) string {
	return strconv.Itoa(n)
}
