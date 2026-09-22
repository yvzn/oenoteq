# Wine Cellar — web

Vue + TypeScript frontend, built with Vite. Embedded into the Go binary at release time (see `internal/static/` and `.github/workflows/release.yml`).

## Dev

```sh
npm install
npm run dev
```

Requires the Go API running on `:8080` (`go run .` from the repo root) — `vite.config.ts` proxies `/wines` and `/health` to it.
