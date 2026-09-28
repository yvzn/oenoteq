## Agent skills

### Issue tracker

Local markdown under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context. See `docs/agents/domain.md`.

### API contract

Endpoint added or changed → add/update matching request in `api.http`.

### DB migrations

App is single-exe deployed (`docs/adr/0002-single-exe-embedded-deployment.md`) — assume real user data exists past the first migration. Never blank `DROP TABLE`/recreate to change a schema; instead rename old table → create new table → copy rows across → drop old table.
