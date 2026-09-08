package handlers

import (
	"encoding/json"
	"net/http"

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
}

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
