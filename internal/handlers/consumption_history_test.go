package handlers

import (
	"net/http"
	"strconv"
	"testing"

	"github.com/younited/wine-cellar-tracker/internal/db"
	"github.com/younited/wine-cellar-tracker/internal/test"
)

func recordTestConsumption(t *testing.T, harness *test.Harness, wineID int, date string) db.Consumption {
	t.Helper()

	resp := harness.Do("POST", "/wines/"+strconv.Itoa(wineID)+"/consumptions", map[string]interface{}{
		"date": date,
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d recording consumption, got %d", http.StatusCreated, resp.StatusCode)
	}

	var consumption db.Consumption
	harness.JSONResponse(resp, &consumption)
	return consumption
}

func listConsumptionHistory(t *testing.T, harness *test.Harness) []db.ConsumptionHistoryEntry {
	t.Helper()

	resp := harness.Do("GET", "/consumptions", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status %d listing consumptions, got %d", http.StatusOK, resp.StatusCode)
	}

	var entries []db.ConsumptionHistoryEntry
	harness.JSONResponse(resp, &entries)
	return entries
}

func entryIDs(entries []db.ConsumptionHistoryEntry) []int {
	ids := make([]int, len(entries))
	for i, e := range entries {
		ids[i] = e.ID
	}
	return ids
}

func TestConsumptionHistoryListsEveryConsumptionWithWineFields(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Chinon")
	wine := createWineWithMillesime(t, harness, appellationID, 2019)

	consumption := recordTestConsumption(t, harness, wine.ID, "2026-03-10")

	entries := listConsumptionHistory(t, harness)
	if len(entries) != 1 {
		t.Fatalf("Expected 1 entry, got %d", len(entries))
	}
	e := entries[0]
	if e.ID != consumption.ID || e.WineID != wine.ID || e.Date != "2026-03-10" {
		t.Errorf("Unexpected id/wine_id/date: %+v", e)
	}
	if e.Producer.ID != wine.ProducerID || e.Producer.Name != wine.Producer.Name {
		t.Errorf("Expected producer %d %q, got %+v", wine.ProducerID, wine.Producer.Name, e.Producer)
	}
	if e.AppellationID != appellationID || e.Color != "rouge" {
		t.Errorf("Expected appellation %d rouge, got %d %q", appellationID, e.AppellationID, e.Color)
	}
	if e.Millesime == nil || *e.Millesime != 2019 {
		t.Errorf("Expected millesime 2019, got %v", e.Millesime)
	}
}

func TestConsumptionHistoryOmitsRatingAndNotes(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Bourgueil")
	wine := createTestWine(t, harness, appellationID, 1)

	harness.Do("POST", "/wines/"+strconv.Itoa(wine.ID)+"/consumptions", map[string]interface{}{
		"date":   "2026-03-10",
		"rating": 5,
		"notes":  "Lovely",
	})

	resp := harness.Do("GET", "/consumptions", nil)
	var raw []map[string]interface{}
	harness.JSONResponse(resp, &raw)
	if len(raw) != 1 {
		t.Fatalf("Expected 1 entry, got %d", len(raw))
	}
	for _, key := range []string{"rating", "notes"} {
		if _, ok := raw[0][key]; ok {
			t.Errorf("Expected no %q field, got %v", key, raw[0][key])
		}
	}
}

func TestConsumptionHistoryIncludesWinesWithQuantityZero(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Anjou")
	wine := createTestWine(t, harness, appellationID, 1)

	consumption := recordTestConsumption(t, harness, wine.ID, "2026-02-01")

	resp := harness.Do("GET", "/wines/"+strconv.Itoa(wine.ID), nil)
	var detail db.WineDetail
	harness.JSONResponse(resp, &detail)
	if detail.Quantity != 0 {
		t.Fatalf("Expected wine finished (quantity 0), got %d", detail.Quantity)
	}

	entries := listConsumptionHistory(t, harness)
	if !slicesEqual(entryIDs(entries), []int{consumption.ID}) {
		t.Errorf("Expected consumption of finished wine listed, got %v", entryIDs(entries))
	}
}

func TestConsumptionHistoryDefaultsToDateDescendingWithIDTieBreak(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Saumur")
	wineA := createTestWine(t, harness, appellationID, 3)
	wineB := createTestWine(t, harness, appellationID, 3)

	oldest := recordTestConsumption(t, harness, wineA.ID, "2025-12-31")
	sameDayFirst := recordTestConsumption(t, harness, wineB.ID, "2026-01-15")
	newest := recordTestConsumption(t, harness, wineA.ID, "2026-02-01")
	sameDaySecond := recordTestConsumption(t, harness, wineA.ID, "2026-01-15")

	got := entryIDs(listConsumptionHistory(t, harness))
	want := []int{newest.ID, sameDaySecond.ID, sameDayFirst.ID, oldest.ID}
	if !slicesEqual(got, want) {
		t.Errorf("Expected order %v, got %v", want, got)
	}
}

func TestConsumptionHistoryEmptyDatabaseReturnsEmptyList(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)

	resp := harness.Do("GET", "/consumptions", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status %d, got %d", http.StatusOK, resp.StatusCode)
	}

	var raw []map[string]interface{}
	harness.JSONResponse(resp, &raw)
	if raw == nil || len(raw) != 0 {
		t.Errorf("Expected empty JSON array, got %v", raw)
	}
}

func listConsumptionHistoryWithQuery(t *testing.T, harness *test.Harness, query string) []db.ConsumptionHistoryEntry {
	t.Helper()

	resp := harness.Do("GET", "/consumptions"+query, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status %d listing consumptions%s, got %d", http.StatusOK, query, resp.StatusCode)
	}

	var entries []db.ConsumptionHistoryEntry
	harness.JSONResponse(resp, &entries)
	return entries
}

// createHistoryWine creates a Wine with the given producer name, appellation
// and millesime (nil for NV), with enough bottles for several Consumptions.
func createHistoryWine(t *testing.T, harness *test.Harness, producerName string, appellationID int, millesime *int) db.Wine {
	t.Helper()

	body := map[string]interface{}{
		"appellation_id":   appellationID,
		"producer_id":      createTestProducer(t, harness, producerName),
		"color":            "rouge",
		"initial_quantity": 1,
	}
	if millesime != nil {
		body["millesime"] = *millesime
	}
	resp := harness.Do("POST", "/wines", body)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("Expected status %d creating wine, got %d", http.StatusCreated, resp.StatusCode)
	}

	var wine db.Wine
	harness.JSONResponse(resp, &wine)
	return applyQuantityAdjustment(t, harness, wine.ID, 5)
}

func intPtr(n int) *int {
	return &n
}

func assertHistoryOrder(t *testing.T, harness *test.Harness, query string, want []int) {
	t.Helper()

	if got := entryIDs(listConsumptionHistoryWithQuery(t, harness, query)); !slicesEqual(got, want) {
		t.Errorf("%s: expected order %v, got %v", query, want, got)
	}
}

func TestConsumptionHistorySortByDateBothDirectionsWithIDTieBreak(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Saumur")
	wine := createTestWine(t, harness, appellationID, 4)

	oldest := recordTestConsumption(t, harness, wine.ID, "2025-12-31")
	sameDayFirst := recordTestConsumption(t, harness, wine.ID, "2026-01-15")
	newest := recordTestConsumption(t, harness, wine.ID, "2026-02-01")
	sameDaySecond := recordTestConsumption(t, harness, wine.ID, "2026-01-15")

	assertHistoryOrder(t, harness, "?sort_by=date&sort_dir=desc",
		[]int{newest.ID, sameDaySecond.ID, sameDayFirst.ID, oldest.ID})
	assertHistoryOrder(t, harness, "?sort_by=date&sort_dir=asc",
		[]int{oldest.ID, sameDaySecond.ID, sameDayFirst.ID, newest.ID})
}

func TestConsumptionHistorySortByProducerBothDirectionsFallsBackToDateThenID(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Chinon")
	alpha := createHistoryWine(t, harness, "Alpha Domaine", appellationID, intPtr(2018))
	beta := createHistoryWine(t, harness, "Beta Domaine", appellationID, intPtr(2018))

	betaOld := recordTestConsumption(t, harness, beta.ID, "2025-06-01")
	alphaOld := recordTestConsumption(t, harness, alpha.ID, "2025-06-01")
	alphaNew := recordTestConsumption(t, harness, alpha.ID, "2026-01-10")
	alphaOldSecond := recordTestConsumption(t, harness, alpha.ID, "2025-06-01")

	assertHistoryOrder(t, harness, "?sort_by=producer&sort_dir=asc",
		[]int{alphaNew.ID, alphaOldSecond.ID, alphaOld.ID, betaOld.ID})
	assertHistoryOrder(t, harness, "?sort_by=producer&sort_dir=desc",
		[]int{betaOld.ID, alphaNew.ID, alphaOldSecond.ID, alphaOld.ID})
}

func TestConsumptionHistorySortByProducerUsesBinaryOrdering(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Chinon")
	lower := createHistoryWine(t, harness, "alpha Domaine", appellationID, intPtr(2018))
	upper := createHistoryWine(t, harness, "Zin Domaine", appellationID, intPtr(2018))

	lowerConsumption := recordTestConsumption(t, harness, lower.ID, "2026-01-01")
	upperConsumption := recordTestConsumption(t, harness, upper.ID, "2026-01-01")

	assertHistoryOrder(t, harness, "?sort_by=producer&sort_dir=asc",
		[]int{upperConsumption.ID, lowerConsumption.ID})
}

func TestConsumptionHistorySortByAppellationBothDirectionsFallsBackToDateThenID(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	anjou := createTestAppellation(t, harness, "Anjou")
	vouvray := createTestAppellation(t, harness, "Vouvray")
	anjouWine := createHistoryWine(t, harness, "Domaine Un", anjou, intPtr(2018))
	vouvrayWine := createHistoryWine(t, harness, "Domaine Deux", vouvray, intPtr(2018))

	vouvrayConsumption := recordTestConsumption(t, harness, vouvrayWine.ID, "2026-03-01")
	anjouOld := recordTestConsumption(t, harness, anjouWine.ID, "2025-01-01")
	anjouNew := recordTestConsumption(t, harness, anjouWine.ID, "2026-01-01")
	anjouNewSecond := recordTestConsumption(t, harness, anjouWine.ID, "2026-01-01")

	assertHistoryOrder(t, harness, "?sort_by=appellation&sort_dir=asc",
		[]int{anjouNewSecond.ID, anjouNew.ID, anjouOld.ID, vouvrayConsumption.ID})
	assertHistoryOrder(t, harness, "?sort_by=appellation&sort_dir=desc",
		[]int{vouvrayConsumption.ID, anjouNewSecond.ID, anjouNew.ID, anjouOld.ID})
}

func TestConsumptionHistorySortByMillesimeBothDirectionsNVLastFallsBackToDateThenID(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Chinon")
	older := createHistoryWine(t, harness, "Domaine Un", appellationID, intPtr(2015))
	younger := createHistoryWine(t, harness, "Domaine Deux", appellationID, intPtr(2020))
	nv := createHistoryWine(t, harness, "Domaine Trois", appellationID, nil)

	nvConsumption := recordTestConsumption(t, harness, nv.ID, "2026-05-01")
	youngerConsumption := recordTestConsumption(t, harness, younger.ID, "2024-01-01")
	olderOld := recordTestConsumption(t, harness, older.ID, "2025-01-01")
	olderNew := recordTestConsumption(t, harness, older.ID, "2026-01-01")
	olderNewSecond := recordTestConsumption(t, harness, older.ID, "2026-01-01")

	assertHistoryOrder(t, harness, "?sort_by=millesime&sort_dir=asc",
		[]int{olderNewSecond.ID, olderNew.ID, olderOld.ID, youngerConsumption.ID, nvConsumption.ID})
	assertHistoryOrder(t, harness, "?sort_by=millesime&sort_dir=desc",
		[]int{youngerConsumption.ID, olderNewSecond.ID, olderNew.ID, olderOld.ID, nvConsumption.ID})
}

func TestConsumptionHistorySortDirAloneKeepsDefaultAxis(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)
	appellationID := createTestAppellation(t, harness, "Saumur")
	wine := createTestWine(t, harness, appellationID, 3)

	older := recordTestConsumption(t, harness, wine.ID, "2025-01-01")
	newer := recordTestConsumption(t, harness, wine.ID, "2026-01-01")

	assertHistoryOrder(t, harness, "?sort_dir=asc", []int{older.ID, newer.ID})
}

func TestConsumptionHistoryRejectsInvalidSortBy(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)

	// "status" is a /search axis but has no meaning for past Consumptions.
	for _, sortBy := range []string{"quantity", "status"} {
		resp := harness.Do("GET", "/consumptions?sort_by="+sortBy, nil)
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("sort_by=%s: expected status %d, got %d", sortBy, http.StatusBadRequest, resp.StatusCode)
		}
		if code := harness.ErrorCode(resp); code != "invalid_sort" {
			t.Errorf("sort_by=%s: expected error code 'invalid_sort', got %q", sortBy, code)
		}
	}
}

func TestConsumptionHistoryRejectsInvalidSortDir(t *testing.T) {
	harness, _ := setupHandlerWithDB(t)

	resp := harness.Do("GET", "/consumptions?sort_dir=sideways", nil)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, resp.StatusCode)
	}
	if code := harness.ErrorCode(resp); code != "invalid_sort" {
		t.Errorf("Expected error code 'invalid_sort', got %q", code)
	}
}
