package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/younited/wine-cellar-tracker/internal/db"
)

type Handler struct {
	db *db.DB
}

func New(database *db.DB) *Handler {
	return &Handler{db: database}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", h.Health)
	mux.HandleFunc("POST /appellations", h.CreateAppellation)
	mux.HandleFunc("GET /appellations", h.ListAppellations)
	mux.HandleFunc("POST /meals", h.CreateMeal)
	mux.HandleFunc("GET /meals", h.ListMeals)
	mux.HandleFunc("POST /wines", h.CreateWine)
	mux.HandleFunc("GET /wines", h.ListWines)
	mux.HandleFunc("GET /wines/{id}", h.GetWine)
	mux.HandleFunc("PUT /wines/{id}", h.UpdateWine)
	mux.HandleFunc("POST /wines/{id}/consumptions", h.CreateConsumption)
	mux.HandleFunc("POST /meal-pairings", h.CreateMealPairing)
	mux.HandleFunc("GET /meal-pairings", h.ListMealPairings)
	mux.HandleFunc("DELETE /meal-pairings", h.DeleteMealPairing)
	mux.HandleFunc("GET /search", h.Search)
}

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (h *Handler) CreateAppellation(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid request"})
		return
	}

	appellation, err := h.db.CreateAppellation(r.Context(), req.Name)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		if errors.Is(err, db.ErrUniqueConstraint) {
			w.WriteHeader(http.StatusConflict)
		} else {
			w.WriteHeader(http.StatusInternalServerError)
		}
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(appellation)
}

func (h *Handler) ListAppellations(w http.ResponseWriter, r *http.Request) {
	appellations, err := h.db.ListAppellations(r.Context())
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	if appellations == nil {
		appellations = []db.Appellation{}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(appellations)
}

func (h *Handler) CreateMeal(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid request"})
		return
	}

	meal, err := h.db.CreateMeal(r.Context(), req.Name)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		if errors.Is(err, db.ErrUniqueConstraint) {
			w.WriteHeader(http.StatusConflict)
		} else {
			w.WriteHeader(http.StatusInternalServerError)
		}
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(meal)
}

func (h *Handler) ListMeals(w http.ResponseWriter, r *http.Request) {
	meals, err := h.db.ListMeals(r.Context())
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	if meals == nil {
		meals = []db.Meal{}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(meals)
}

type wineRequest struct {
	Millesime     *int   `json:"millesime"`
	AppellationID int    `json:"appellation_id"`
	Producer      string `json:"producer"`
	Color         string `json:"color"`
	GardeDebut    int    `json:"garde_debut"`
	GardeFin      int    `json:"garde_fin"`
	Quantity      int    `json:"quantity"`
}

func (req wineRequest) toWine() db.Wine {
	return db.Wine{
		Millesime:     req.Millesime,
		AppellationID: req.AppellationID,
		Producer:      req.Producer,
		Color:         req.Color,
		GardeDebut:    req.GardeDebut,
		GardeFin:      req.GardeFin,
		Quantity:      req.Quantity,
	}
}

func wineErrorStatus(err error) int {
	switch {
	case errors.Is(err, db.ErrInvalidColor), errors.Is(err, db.ErrInvalidQuantity), errors.Is(err, db.ErrAppellationNotFound):
		return http.StatusBadRequest
	case errors.Is(err, db.ErrWineNotFound):
		return http.StatusNotFound
	default:
		return http.StatusInternalServerError
	}
}

func (h *Handler) CreateWine(w http.ResponseWriter, r *http.Request) {
	var req wineRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid request"})
		return
	}

	wine, err := h.db.CreateWine(r.Context(), req.toWine())
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(wineErrorStatus(err))
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(wine)
}

func (h *Handler) ListWines(w http.ResponseWriter, r *http.Request) {
	wines, err := h.db.ListWines(r.Context())
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	if wines == nil {
		wines = []db.Wine{}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(wines)
}

func (h *Handler) GetWine(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid wine id"})
		return
	}

	wine, err := h.db.GetWineDetail(r.Context(), id)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(wineErrorStatus(err))
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(wine)
}

type consumptionRequest struct {
	Date   string  `json:"date"`
	Rating *int    `json:"rating"`
	Notes  *string `json:"notes"`
}

func consumptionErrorStatus(err error) int {
	switch {
	case errors.Is(err, db.ErrDateRequired), errors.Is(err, db.ErrInvalidDate), errors.Is(err, db.ErrInvalidRating):
		return http.StatusBadRequest
	case errors.Is(err, db.ErrWineNotFound):
		return http.StatusNotFound
	case errors.Is(err, db.ErrQuantityZero):
		return http.StatusConflict
	default:
		return http.StatusInternalServerError
	}
}

func (h *Handler) CreateConsumption(w http.ResponseWriter, r *http.Request) {
	wineID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid wine id"})
		return
	}

	var req consumptionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid request"})
		return
	}

	consumption, err := h.db.CreateConsumption(r.Context(), db.Consumption{
		WineID: wineID,
		Date:   req.Date,
		Rating: req.Rating,
		Notes:  req.Notes,
	})
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(consumptionErrorStatus(err))
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(consumption)
}

func mealPairingErrorStatus(err error) int {
	switch {
	case errors.Is(err, db.ErrInvalidColor), errors.Is(err, db.ErrAppellationNotFound), errors.Is(err, db.ErrMealNotFound):
		return http.StatusBadRequest
	default:
		return http.StatusInternalServerError
	}
}

type mealPairingRequest struct {
	AppellationID int    `json:"appellation_id"`
	Color         string `json:"color"`
	MealID        int    `json:"meal_id"`
}

func (h *Handler) CreateMealPairing(w http.ResponseWriter, r *http.Request) {
	var req mealPairingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid request"})
		return
	}

	if err := h.db.CreateMealPairing(r.Context(), req.AppellationID, req.Color, req.MealID); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(mealPairingErrorStatus(err))
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(req)
}

func (h *Handler) DeleteMealPairing(w http.ResponseWriter, r *http.Request) {
	var req mealPairingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid request"})
		return
	}

	if err := h.db.DeleteMealPairing(r.Context(), req.AppellationID, req.Color, req.MealID); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(mealPairingErrorStatus(err))
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) ListMealPairings(w http.ResponseWriter, r *http.Request) {
	appellationID, err := strconv.Atoi(r.URL.Query().Get("appellation_id"))
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid appellation_id"})
		return
	}
	color := r.URL.Query().Get("color")

	meals, err := h.db.ListMealsForPairing(r.Context(), appellationID, color)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(mealPairingErrorStatus(err))
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	if meals == nil {
		meals = []db.Meal{}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(meals)
}

func searchErrorStatus(err error) int {
	switch {
	case errors.Is(err, db.ErrInvalidColor):
		return http.StatusBadRequest
	default:
		return http.StatusInternalServerError
	}
}

func (h *Handler) Search(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	var filters db.SearchFilters

	if v := q.Get("meal_id"); v != "" {
		id, err := strconv.Atoi(v)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "invalid meal_id"})
			return
		}
		filters.MealID = &id
	}

	if v := q.Get("appellation_id"); v != "" {
		id, err := strconv.Atoi(v)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "invalid appellation_id"})
			return
		}
		filters.AppellationID = &id
	}

	if v := q.Get("color"); v != "" {
		filters.Color = &v
	}

	filters.ReadyNow = q.Get("ready_now") == "true"

	results, err := h.db.SearchWines(r.Context(), filters)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(searchErrorStatus(err))
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	if results == nil {
		results = []db.WineSearchResult{}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(results)
}

func (h *Handler) UpdateWine(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid wine id"})
		return
	}

	var req wineRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid request"})
		return
	}

	wine, err := h.db.UpdateWine(r.Context(), id, req.toWine())
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(wineErrorStatus(err))
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(wine)
}
