# Wine Cellar Tracker

Self-hosted, single-user app for tracking a wine cellar: what's owned, its drinking window, and which meals pair well with it.

## Requirements

- Go 1.22+
- Node 20+ (npm)

## Running locally (dev)

Two processes, run in separate terminals.

**API** (repo root):

```powershell
$env:DB_PATH = "$PWD\cellar.db"
go run .
```

Starts the Go API on `:8080`, backed by SQLite (`cellar.db`, created/migrated automatically on first run).

**Frontend** (`web/`):

```sh
cd web
npm install
npm run dev
```

Starts the Vite dev server (with hot reload) and proxies `/wines` and `/health` to the API on `:8080` (see `web/vite.config.ts`). Open the URL Vite prints (typically `http://localhost:5173`).

## Tests

```sh
go test ./...
```

## API

Endpoints are documented as runnable requests in `api.http`.

## Production build

In short: the frontend is built and embedded into the Go binary via `go:embed`, producing a single executable, published as a GitHub Release on tag push.
