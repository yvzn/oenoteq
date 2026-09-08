package test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/younited/wine-cellar-tracker/internal/db"
)

type Harness struct {
	DB     *db.DB
	Client *http.Client
	Server *httptest.Server
	t      *testing.T
}

func New(t *testing.T, handler http.Handler) *Harness {
	t.Helper()

	database, err := db.Open(":memory:")
	if err != nil {
		t.Fatalf("Opening database: %v", err)
	}

	if err := database.Migrate(context.Background()); err != nil {
		t.Fatalf("Migrating database: %v", err)
	}

	server := httptest.NewServer(handler)
	t.Cleanup(func() {
		server.Close()
		database.Close()
	})

	return &Harness{
		DB:     database,
		Client: server.Client(),
		Server: server,
		t:      t,
	}
}

func (h *Harness) Do(method, path string, body interface{}) *http.Response {
	h.t.Helper()

	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			h.t.Fatalf("Marshaling body: %v", err)
		}
		bodyReader = bytes.NewReader(b)
	}

	req, err := http.NewRequest(method, h.Server.URL+path, bodyReader)
	if err != nil {
		h.t.Fatalf("Creating request: %v", err)
	}

	resp, err := h.Client.Do(req)
	if err != nil {
		h.t.Fatalf("Making request: %v", err)
	}

	return resp
}

func (h *Harness) JSONResponse(resp *http.Response, v interface{}) {
	h.t.Helper()

	defer resp.Body.Close()
	if err := json.NewDecoder(resp.Body).Decode(v); err != nil {
		h.t.Fatalf("Decoding response: %v", err)
	}
}
