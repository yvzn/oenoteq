---
status: accepted
---

# Native Android client is local-only, separate from the PWA and backend

A native Android app (`android/Oenoteq`) offers the same features as the PWA, but keeps the cellar only in a SQLite database on the phone. It never talks to the Go backend: no sync, no account, and no `INTERNET` permission. Android Auto Backup (database file only, cloud backup and device transfer) is the one safety net, accepting that it runs at Android's discretion, roughly daily, so the last day of changes can be lost. A cellar already kept by the backend comes over once, through an all-or-nothing import of a SQLite snapshot into an empty cellar.

The app is Kotlin, Jetpack Compose (Material 3) and Room, in one activity with type-safe Navigation, with dependencies wired by hand (`AppContainer`), no DI framework. The rules the Go `db` layer enforces are enforced again in the app's repositories, and the PWA's domain logic (Garde Status, search and history ordering, pagination, form rules) is ported with its tests; the cellar search runs the same `testdata/search-fixtures.json` cases as the Go and TypeScript code.

## Considered Options

- **Sync with the backend, as the PWA's Offline Mode does** — rejected: the point is a phone that owns its cellar; syncing would bring back accounts, connectivity and conflict handling for a single-user app.
- **Wrap the PWA (TWA or WebView)** — rejected: still needs the server, and the app should feel native.
- **Kotlin Multiplatform shared with the backend, or a shared rules library** — rejected: different languages (Go, TypeScript, Kotlin); porting small rules with shared test fixtures is cheaper than a shared runtime.
- **A manual export/import for backups** — deferred: Auto Backup covers device loss for now.

## Consequences

- Two codebases implement the same domain. A rule change lands in Go, TypeScript and Kotlin together; the shared search fixtures and ported tests catch drift.
- Cookie Consent, Offline Mode and Change to Sync are PWA concepts and don't exist in the Android app: its data is always on the device and always kept.
- The Room schema starts from the backend's after migration 006, minus sync-only columns. Every later schema change ships a Room `Migration` and a migration test; destructive migration is never allowed, since real cellars live in the file.
- The snapshot import accepts exactly one backend schema version; when the backend schema changes, the importer and its fixture change with it.
- English and French as in ADR 0011, with Android resources instead of vue-i18n; the language choice is kept per app by Android.
