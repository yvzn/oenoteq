package handlers

import (
	"encoding/json"
	"net/url"
	"os"
	"strconv"
	"testing"
	"time"
)

// The same fixtures drive the TypeScript local search tests
// (web/src/domain/localSearch.test.ts), proving the two implementations agree.
type searchFixtures struct {
	Appellations []struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"appellations"`
	Producers []struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"producers"`
	Meals []struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"meals"`
	Pairings []struct {
		AppellationID int    `json:"appellation_id"`
		Color         string `json:"color"`
		MealID        int    `json:"meal_id"`
	} `json:"pairings"`
	Wines []struct {
		ID               int    `json:"id"`
		ProducerID       int    `json:"producer_id"`
		AppellationID    int    `json:"appellation_id"`
		Millesime        *int   `json:"millesime"`
		Color            string `json:"color"`
		GardeDebutOffset *int   `json:"garde_debut_offset"`
		GardeFinOffset   *int   `json:"garde_fin_offset"`
		Quantity         int    `json:"quantity"`
	} `json:"wines"`
	Cases []struct {
		Name          string `json:"name"`
		MealID        *int   `json:"meal_id"`
		AppellationID *int   `json:"appellation_id"`
		Color         string `json:"color"`
		ReadyNow      bool   `json:"ready_now"`
		SortBy        string `json:"sort_by"`
		SortDir       string `json:"sort_dir"`
		Expected      []int  `json:"expected"`
	} `json:"cases"`
}

func TestSearchMatchesSharedFixtures(t *testing.T) {
	raw, err := os.ReadFile("../../testdata/search-fixtures.json")
	if err != nil {
		t.Fatalf("Reading fixtures: %v", err)
	}
	var fx searchFixtures
	if err := json.Unmarshal(raw, &fx); err != nil {
		t.Fatalf("Parsing fixtures: %v", err)
	}

	harness, _ := setupHandlerWithDB(t)
	year := time.Now().Year()

	// Fixture ids -> ids the server assigned.
	appellations := map[int]int{}
	for _, a := range fx.Appellations {
		appellations[a.ID] = createTestAppellation(t, harness, a.Name)
	}
	producers := map[int]int{}
	for _, p := range fx.Producers {
		producers[p.ID] = createTestProducer(t, harness, p.Name)
	}
	meals := map[int]int{}
	for _, m := range fx.Meals {
		meals[m.ID] = createTestMeal(t, harness, m.Name)
	}
	for _, p := range fx.Pairings {
		harness.Do("POST", "/meal-pairings", map[string]interface{}{
			"appellation_id": appellations[p.AppellationID],
			"color":          p.Color,
			"meal_id":        meals[p.MealID],
		})
	}
	serverToFixture := map[int]int{}
	for _, w := range fx.Wines {
		body := map[string]interface{}{
			"appellation_id":   appellations[w.AppellationID],
			"producer_id":      producers[w.ProducerID],
			"color":            w.Color,
			"initial_quantity": 1,
		}
		if w.Millesime != nil {
			body["millesime"] = *w.Millesime
		}
		if w.GardeDebutOffset != nil {
			body["garde_debut"] = year + *w.GardeDebutOffset
		}
		if w.GardeFinOffset != nil {
			body["garde_fin"] = year + *w.GardeFinOffset
		}
		resp := harness.Do("POST", "/wines", body)
		if resp.StatusCode != 201 {
			t.Fatalf("Expected status 201 creating fixture wine %d, got %d", w.ID, resp.StatusCode)
		}
		var created struct {
			ID int `json:"id"`
		}
		harness.JSONResponse(resp, &created)
		if delta := w.Quantity - 1; delta != 0 {
			applyQuantityAdjustment(t, harness, created.ID, delta)
		}
		serverToFixture[created.ID] = w.ID
	}

	for _, c := range fx.Cases {
		t.Run(c.Name, func(t *testing.T) {
			q := url.Values{}
			if c.MealID != nil {
				q.Set("meal_id", strconv.Itoa(meals[*c.MealID]))
			}
			if c.AppellationID != nil {
				// An id no fixture defines stays as-is, so it matches nothing.
				id, ok := appellations[*c.AppellationID]
				if !ok {
					id = *c.AppellationID
				}
				q.Set("appellation_id", strconv.Itoa(id))
			}
			if c.Color != "" {
				q.Set("color", c.Color)
			}
			if c.ReadyNow {
				q.Set("ready_now", "true")
			}
			if c.SortBy != "" {
				q.Set("sort_by", c.SortBy)
			}
			if c.SortDir != "" {
				q.Set("sort_dir", c.SortDir)
			}
			query := ""
			if len(q) > 0 {
				query = "?" + q.Encode()
			}

			got := []int{}
			for _, r := range doSearch(t, harness, query) {
				got = append(got, serverToFixture[r.ID])
			}

			if len(got) != len(c.Expected) {
				t.Fatalf("Expected %v, got %v", c.Expected, got)
			}
			for i := range got {
				if got[i] != c.Expected[i] {
					t.Fatalf("Expected %v, got %v", c.Expected, got)
				}
			}
		})
	}
}
