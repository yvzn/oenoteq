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
