# Wine Cellar — web

Vue + TypeScript frontend, built with Vite. Embedded into the Go binary at release time (see `webapp/internal/static/` and `.github/workflows/release.yml`).

## Dev

```sh
npm install
npm run dev
```

Requires the Go API running on `:8080` (`go run .` from `webapp/`) — `vite.config.ts` proxies `/wines` and `/health` to it.
