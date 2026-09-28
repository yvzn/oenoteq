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

// Machine-readable error codes returned to the client. The frontend owns the
// user-facing copy for each of these; new codes must be paired with a mapping
// there (see web/src/api/errorMessages.ts).
const (
	codeInvalidRequest       = "invalid_request"
	codeInvalidWineID        = "invalid_wine_id"
	codeInvalidMealID        = "invalid_meal_id"
	codeInvalidAppellationID = "invalid_appellation_id"
	codeInvalidProducerID    = "invalid_producer_id"
	codeInvalidConsumptionID = "invalid_consumption_id"
	codeAlreadyExists        = "already_exists"
	codeInvalidColor         = "invalid_color"
	codeInvalidSort          = "invalid_sort"
	codeInvalidQuantity      = "invalid_quantity"
	codeAppellationNotFound  = "appellation_not_found"
	codeProducerNotFound     = "producer_not_found"
	codeWineNotFound         = "wine_not_found"
	codeMealNotFound         = "meal_not_found"
	codeMealInUse            = "meal_in_use"
	codeAppellationInUse     = "appellation_in_use"
	codeProducerInUse        = "producer_in_use"
	codeDateRequired         = "date_required"
	codeInvalidDate          = "invalid_date"
	codeInvalidRating        = "invalid_rating"
	codeQuantityZero         = "quantity_zero"
	codeConsumptionNotFound  = "consumption_not_found"
	codeInternal             = "internal_error"
)

// dbErrorCode maps known db sentinel errors to a stable code. Unrecognized
// errors (including raw driver/SQL errors) fall back to codeInternal so no
// backend implementation detail reaches the client.
func dbErrorCode(err error) string {
	switch {
	case errors.Is(err, db.ErrUniqueConstraint):
		return codeAlreadyExists
	case errors.Is(err, db.ErrInvalidColor):
		return codeInvalidColor
	case errors.Is(err, db.ErrInvalidSort):
		return codeInvalidSort
	case errors.Is(err, db.ErrInvalidQuantity):
		return codeInvalidQuantity
	case errors.Is(err, db.ErrAppellationNotFound):
		return codeAppellationNotFound
	case errors.Is(err, db.ErrProducerNotFound):
		return codeProducerNotFound
	case errors.Is(err, db.ErrWineNotFound):
		return codeWineNotFound
	case errors.Is(err, db.ErrMealNotFound):
		return codeMealNotFound
	case errors.Is(err, db.ErrMealInUse):
		return codeMealInUse
	case errors.Is(err, db.ErrAppellationInUse):
		return codeAppellationInUse
	case errors.Is(err, db.ErrProducerInUse):
		return codeProducerInUse
	case errors.Is(err, db.ErrDateRequired):
		return codeDateRequired
	case errors.Is(err, db.ErrInvalidDate):
		return codeInvalidDate
	case errors.Is(err, db.ErrInvalidRating):
		return codeInvalidRating
	case errors.Is(err, db.ErrQuantityZero):
		return codeQuantityZero
	case errors.Is(err, db.ErrConsumptionNotFound):
		return codeConsumptionNotFound
	default:
		return codeInternal
	}
}

func writeError(w http.ResponseWriter, status int, code string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": code})
}

// Register wires the API routes onto mux, plus spa as the catch-all "/"
// handler serving the frontend. Go 1.22+ ServeMux dispatches by pattern
// specificity, so the API routes above always win over the "/" catch-all.
func (h *Handler) Register(mux *http.ServeMux, spa http.Handler) {
	mux.HandleFunc("GET /health", h.Health)
	mux.HandleFunc("POST /appellations", h.CreateAppellation)
	mux.HandleFunc("GET /appellations", h.ListAppellations)
	mux.HandleFunc("PUT /appellations/{id}", h.UpdateAppellation)
	mux.HandleFunc("DELETE /appellations/{id}", h.DeleteAppellation)
	mux.HandleFunc("POST /producers", h.CreateProducer)
	mux.HandleFunc("GET /producers", h.ListProducers)
	mux.HandleFunc("PUT /producers/{id}", h.UpdateProducer)
	mux.HandleFunc("DELETE /producers/{id}", h.DeleteProducer)
	mux.HandleFunc("POST /meals", h.CreateMeal)
	mux.HandleFunc("GET /meals", h.ListMeals)
	mux.HandleFunc("PUT /meals/{id}", h.UpdateMeal)
	mux.HandleFunc("DELETE /meals/{id}", h.DeleteMeal)
	mux.HandleFunc("POST /wines", h.CreateWine)
	mux.HandleFunc("GET /wines", h.ListWines)
	mux.HandleFunc("GET /wines/{id}", h.GetWine)
	mux.HandleFunc("PUT /wines/{id}", h.UpdateWine)
	mux.HandleFunc("POST /wines/{id}/consumptions", h.CreateConsumption)
	mux.HandleFunc("PUT /consumptions/{id}", h.UpdateConsumption)
	mux.HandleFunc("DELETE /consumptions/{id}", h.DeleteConsumption)
	mux.HandleFunc("POST /meal-pairings", h.CreateMealPairing)
	mux.HandleFunc("GET /meal-pairings", h.ListMealPairings)
	mux.HandleFunc("DELETE /meal-pairings", h.DeleteMealPairing)
	mux.HandleFunc("GET /search", h.Search)
	mux.Handle("/", spa)
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
		writeError(w, http.StatusBadRequest, codeInvalidRequest)
		return
	}

	appellation, err := h.db.CreateAppellation(r.Context(), req.Name)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, db.ErrUniqueConstraint) {
			status = http.StatusConflict
		}
		writeError(w, status, dbErrorCode(err))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(appellation)
}

func (h *Handler) ListAppellations(w http.ResponseWriter, r *http.Request) {
	appellations, err := h.db.ListAppellations(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, dbErrorCode(err))
		return
	}

	if appellations == nil {
		appellations = []db.Appellation{}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(appellations)
}

func appellationErrorStatus(err error) int {
	switch {
	case errors.Is(err, db.ErrUniqueConstraint):
		return http.StatusConflict
	case errors.Is(err, db.ErrAppellationInUse):
		return http.StatusConflict
	case errors.Is(err, db.ErrAppellationNotFound):
		return http.StatusNotFound
	default:
		return http.StatusInternalServerError
	}
}

func (h *Handler) UpdateAppellation(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, codeInvalidAppellationID)
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, codeInvalidRequest)
		return
	}

	appellation, err := h.db.UpdateAppellation(r.Context(), id, req.Name)
	if err != nil {
		writeError(w, appellationErrorStatus(err), dbErrorCode(err))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(appellation)
}

func (h *Handler) DeleteAppellation(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, codeInvalidAppellationID)
		return
	}

	if err := h.db.DeleteAppellation(r.Context(), id); err != nil {
		writeError(w, appellationErrorStatus(err), dbErrorCode(err))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) CreateProducer(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, codeInvalidRequest)
		return
	}

	producer, err := h.db.CreateProducer(r.Context(), req.Name)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, db.ErrUniqueConstraint) {
			status = http.StatusConflict
		}
		writeError(w, status, dbErrorCode(err))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(producer)
}

func (h *Handler) ListProducers(w http.ResponseWriter, r *http.Request) {
	producers, err := h.db.ListProducers(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, dbErrorCode(err))
		return
	}

	if producers == nil {
		producers = []db.Producer{}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(producers)
}

func producerErrorStatus(err error) int {
	switch {
	case errors.Is(err, db.ErrUniqueConstraint):
		return http.StatusConflict
	case errors.Is(err, db.ErrProducerInUse):
		return http.StatusConflict
	case errors.Is(err, db.ErrProducerNotFound):
		return http.StatusNotFound
	default:
		return http.StatusInternalServerError
	}
}

func (h *Handler) UpdateProducer(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, codeInvalidProducerID)
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, codeInvalidRequest)
		return
	}

	producer, err := h.db.UpdateProducer(r.Context(), id, req.Name)
	if err != nil {
		writeError(w, producerErrorStatus(err), dbErrorCode(err))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(producer)
}

func (h *Handler) DeleteProducer(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, codeInvalidProducerID)
		return
	}

	if err := h.db.DeleteProducer(r.Context(), id); err != nil {
		writeError(w, producerErrorStatus(err), dbErrorCode(err))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) CreateMeal(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, codeInvalidRequest)
		return
	}

	meal, err := h.db.CreateMeal(r.Context(), req.Name)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, db.ErrUniqueConstraint) {
			status = http.StatusConflict
		}
		writeError(w, status, dbErrorCode(err))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(meal)
}

func (h *Handler) ListMeals(w http.ResponseWriter, r *http.Request) {
	meals, err := h.db.ListMeals(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, dbErrorCode(err))
		return
	}

	if meals == nil {
		meals = []db.Meal{}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(meals)
}

func mealErrorStatus(err error) int {
	switch {
	case errors.Is(err, db.ErrUniqueConstraint):
		return http.StatusConflict
	case errors.Is(err, db.ErrMealInUse):
		return http.StatusConflict
	case errors.Is(err, db.ErrMealNotFound):
		return http.StatusNotFound
	default:
		return http.StatusInternalServerError
	}
}

func (h *Handler) UpdateMeal(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, codeInvalidMealID)
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, codeInvalidRequest)
		return
	}

	meal, err := h.db.UpdateMeal(r.Context(), id, req.Name)
	if err != nil {
		writeError(w, mealErrorStatus(err), dbErrorCode(err))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(meal)
}

func (h *Handler) DeleteMeal(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, codeInvalidMealID)
		return
	}

	if err := h.db.DeleteMeal(r.Context(), id); err != nil {
		writeError(w, mealErrorStatus(err), dbErrorCode(err))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

type wineRequest struct {
	Millesime     *int   `json:"millesime"`
	AppellationID int    `json:"appellation_id"`
	ProducerID    int    `json:"producer_id"`
	Color         string `json:"color"`
	GardeDebut    *int   `json:"garde_debut"`
	GardeFin      *int   `json:"garde_fin"`
	Quantity      int    `json:"quantity"`
}

func (req wineRequest) toWine() db.Wine {
	return db.Wine{
		Millesime:     req.Millesime,
		AppellationID: req.AppellationID,
		ProducerID:    req.ProducerID,
		Color:         req.Color,
		GardeDebut:    req.GardeDebut,
		GardeFin:      req.GardeFin,
		Quantity:      req.Quantity,
	}
}

func wineErrorStatus(err error) int {
	switch {
	case errors.Is(err, db.ErrInvalidColor), errors.Is(err, db.ErrInvalidQuantity), errors.Is(err, db.ErrAppellationNotFound), errors.Is(err, db.ErrProducerNotFound):
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
		writeError(w, http.StatusBadRequest, codeInvalidRequest)
		return
	}

	wine, err := h.db.CreateWine(r.Context(), req.toWine())
	if err != nil {
		writeError(w, wineErrorStatus(err), dbErrorCode(err))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(wine)
}

func (h *Handler) ListWines(w http.ResponseWriter, r *http.Request) {
	wines, err := h.db.ListWines(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, dbErrorCode(err))
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
		writeError(w, http.StatusBadRequest, codeInvalidWineID)
		return
	}

	wine, err := h.db.GetWineDetail(r.Context(), id)
	if err != nil {
		writeError(w, wineErrorStatus(err), dbErrorCode(err))
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
	case errors.Is(err, db.ErrConsumptionNotFound):
		return http.StatusNotFound
	default:
		return http.StatusInternalServerError
	}
}

func (h *Handler) CreateConsumption(w http.ResponseWriter, r *http.Request) {
	wineID, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, codeInvalidWineID)
		return
	}

	var req consumptionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, codeInvalidRequest)
		return
	}

	consumption, err := h.db.CreateConsumption(r.Context(), db.Consumption{
		WineID: wineID,
		Date:   req.Date,
		Rating: req.Rating,
		Notes:  req.Notes,
	})
	if err != nil {
		writeError(w, consumptionErrorStatus(err), dbErrorCode(err))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(consumption)
}

func (h *Handler) UpdateConsumption(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, codeInvalidConsumptionID)
		return
	}

	var req consumptionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, codeInvalidRequest)
		return
	}

	consumption, err := h.db.UpdateConsumption(r.Context(), id, req.Date, req.Rating, req.Notes)
	if err != nil {
		writeError(w, consumptionErrorStatus(err), dbErrorCode(err))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(consumption)
}

func (h *Handler) DeleteConsumption(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, codeInvalidConsumptionID)
		return
	}

	if err := h.db.DeleteConsumption(r.Context(), id); err != nil {
		writeError(w, consumptionErrorStatus(err), dbErrorCode(err))
		return
	}

	w.WriteHeader(http.StatusNoContent)
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
		writeError(w, http.StatusBadRequest, codeInvalidRequest)
		return
	}

	if err := h.db.CreateMealPairing(r.Context(), req.AppellationID, req.Color, req.MealID); err != nil {
		writeError(w, mealPairingErrorStatus(err), dbErrorCode(err))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(req)
}

func (h *Handler) DeleteMealPairing(w http.ResponseWriter, r *http.Request) {
	var req mealPairingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, codeInvalidRequest)
		return
	}

	if err := h.db.DeleteMealPairing(r.Context(), req.AppellationID, req.Color, req.MealID); err != nil {
		writeError(w, mealPairingErrorStatus(err), dbErrorCode(err))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) ListMealPairings(w http.ResponseWriter, r *http.Request) {
	appellationID, err := strconv.Atoi(r.URL.Query().Get("appellation_id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, codeInvalidAppellationID)
		return
	}
	color := r.URL.Query().Get("color")

	meals, err := h.db.ListMealsForPairing(r.Context(), appellationID, color)
	if err != nil {
		writeError(w, mealPairingErrorStatus(err), dbErrorCode(err))
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
	case errors.Is(err, db.ErrInvalidColor), errors.Is(err, db.ErrInvalidSort):
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
			writeError(w, http.StatusBadRequest, codeInvalidMealID)
			return
		}
		filters.MealID = &id
	}

	if v := q.Get("appellation_id"); v != "" {
		id, err := strconv.Atoi(v)
		if err != nil {
			writeError(w, http.StatusBadRequest, codeInvalidAppellationID)
			return
		}
		filters.AppellationID = &id
	}

	if v := q.Get("color"); v != "" {
		filters.Color = &v
	}

	filters.ReadyNow = q.Get("ready_now") == "true"

	filters.SortBy = q.Get("sort_by")
	if filters.SortBy == "" {
		filters.SortBy = "appellation"
	}
	filters.SortDir = q.Get("sort_dir")
	if filters.SortDir == "" {
		filters.SortDir = "asc"
	}

	results, err := h.db.SearchWines(r.Context(), filters)
	if err != nil {
		writeError(w, searchErrorStatus(err), dbErrorCode(err))
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
		writeError(w, http.StatusBadRequest, codeInvalidWineID)
		return
	}

	var req wineRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, codeInvalidRequest)
		return
	}

	wine, err := h.db.UpdateWine(r.Context(), id, req.toWine())
	if err != nil {
		writeError(w, wineErrorStatus(err), dbErrorCode(err))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(wine)
}
