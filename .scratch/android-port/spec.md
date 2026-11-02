# Wine Cellar — native Android app (local-only)

Status: needs-triage

## Problem Statement

The cellar is used mostly from a phone, through the PWA. The PWA only fully works when the phone is on the home Wi-Fi with the PC running the Go exe (ADR 0002, ADR 0006): away from home, changes sit in the outbox as Changes to Sync, the Consumption History page is unavailable, and the user has to look after the sync page, consent choices and failed changes. Most of the PWA's complexity (outbox, id remapping, quantity-delta reconciliation, two data gateway adapters, Cookie Consent, service worker updates) exists only to keep a phone copy and a server copy in step. For a single user who carries the cellar in their pocket, that machinery costs more than it gives.

## Solution

A native Android app, **Oenoteq**, in `android/Oenoteq/`, with exactly the PWA's user-facing feature set, but whose cellar lives only in an on-device SQLite database. It has no backend, no sync, no network access and no Cookie Consent. Device-level safety comes from Android Auto Backup, which the app keeps enabled so the database follows the user's Google account to a new phone.

Built with Kotlin, Jetpack Compose (Material 3), Room and Navigation Compose, as a single-activity app. English and French, as in the PWA.

The PWA and Go backend stay as they are. The two apps are independent and do not share data.

## User Stories

### Cellar list

1. As a user, I want the app to open on my cellar list, so that I see what I own straight away.
2. As a user, I want the cellar list to show only Wines with quantity above 0, so that finished Wines don't clutter it.
3. As a user, I want each row to show color, producer, appellation, millesime, quantity and Garde Status, so that I can recognise a bottle and know whether to open it.
4. As a user, I want to filter by appellation, color and meal (through the current Meal Pairings), alone or combined, so that I can find a wine for tonight's dinner.
5. As a user, I want a "ready now" filter that keeps only Wines whose Garde Status is `ready`, so that I don't open a bottle too early or too late; `unassessed` Wines never qualify.
6. As a user, I want to sort by producer, appellation, millesime or Garde Status, ascending or descending, so that I can browse the cellar the way I need.
7. As a user, I want a filter count and a "clear filters" action whenever a filter is active, so that I get back to the full cellar in one tap.
8. As a user, I want long lists paged 10 at a time like the PWA, so that the list stays readable and behaves the same.
9. As a user, I want to come back from a Wine's detail page to the same filters, sort, page and scroll position, so that I don't lose my place.
10. As a user with an empty cellar, I want a clear empty state with a way to add my first Wine; with filters that match nothing, I want "no wine matches these filters".

### Wine

11. As a user, I want to add a Wine with millesime (optional, for NV wines), appellation, producer, color, garde start/end (each optional) and an initial quantity of at least 1, so that every new Wine starts in stock (ADR 0007).
12. As a user, I want appellation and producer fields with type-ahead autocomplete, and a "create new" option when nothing matches, so that I don't leave the form to add a missing Appellation or Producer.
13. As a user, I want to edit a Wine's millesime, appellation, producer, color and garde, but never its quantity directly from the form, so that stock only changes through Consumption or a correction.
14. As a user, I want a Wine's detail page to show all its fields, its Garde Status, its suggested Meals (from its Meal Pairing) and its Consumptions, so that I see everything about the bottle in one place.
15. As a user, I want to correct the quantity up or down from the detail page, never below 0, so that I can fix a stock count.
16. As a user, I want a Wine to stay reachable after its quantity reaches 0 (from the Consumption History), so that its past Consumptions stay visible.
17. As a user, I want a short success confirmation after saving, and the changed values highlighted when I come back to the page, so that I know what changed.

### Consumption

18. As a user, I want to record a Consumption with a date (required, defaulting to today), an optional rating 1–5 and optional notes, which takes one unit off the Wine's quantity, so that stock stays right.
19. As a user, I want recording a Consumption on a Wine at quantity 0 to be refused, so that stock never goes negative.
20. As a user, I want to edit a Consumption's date, rating and notes, so that I can fix a mistake.
21. As a user, I want deleting a Consumption, after confirmation, to give the unit back to the Wine, so that stock stays right.

### Consumption History

22. As a user, I want a History screen listing every Consumption across all Wines, one row per Consumption, newest first, including Wines now at quantity 0, so that I can look back at what I drank.
23. As a user, I want to sort it by producer, appellation, millesime or date, and filter it by appellation, color and meal, with the same controls as the cellar list (without "ready now"), so that it feels familiar.
24. As a user, I want a row to open the Wine's detail page, and back to return to the same filters, sort, page and scroll, so that I can drill in and out.
25. As a user, I want the History to work everywhere, since all data is on my phone, so that it is never "unavailable".

### Manage

26. As a user, I want a Manage hub giving access to Producers, Appellations, Meals and Meal Pairings, so that reference data has one home.
27. As a user, I want to list (alphabetically), add, rename and delete Producers, Appellations and Meals, so that reference data stays tidy.
28. As a user, I want a duplicate name to be refused with a clear message, so that I don't end up with two entries for the same thing.
29. As a user, I want deleting a Producer or Appellation used by a Wine, an Appellation used by a Meal Pairing, or a Meal used by a Meal Pairing, to be refused with a clear message, so that I never break a Wine or a Pairing.
30. As a user, I want every delete to ask for confirmation first, so that I don't remove something by accident.
31. As a user, I want to pick an Appellation and a Color and see, add and remove the Meals paired with them, so that suggestions match my taste.
32. As a user, I want creating a new Meal from the Meal Pairing screen to pair it straight away with the current Appellation and Color, so that one action covers both.

### App shell and language

33. As a user, I want a bottom navigation (or equivalent) with Cellar, History and Manage, so that I can move between the main areas from anywhere.
34. As a French-speaking user, I want the whole app in French when my phone is in French, so that it feels native.
35. As a user, I want to switch between English and French from inside the app, regardless of my phone's language, and have the choice remembered, so that I can use my preferred language.
36. As a user, I want dates and numbers formatted for the current language, so that they read naturally.
37. As a user, I want errors in plain language (e.g. "This producer is used by a wine and can't be deleted"), never technical codes, so that I know what to do.
38. As a user, I want the app to follow my phone's light/dark theme, so that it fits the rest of my phone.

### Data safety

39. As a user, I want my cellar to be included in Android's automatic backup to my Google account, so that a new or reset phone gets it back.
40. As a user, I want my cellar to be kept across app updates, so that installing a new version never loses data.
41. As a user, I want the app to work with no network permission at all, so that I know my cellar stays on my phone.

### One-time import

42. As a user moving from the PWA, I want to import my existing cellar once from a SQLite snapshot of the backend database, so that I don't retype every Wine, Consumption and reference list.
43. As a user, I want to pick the snapshot file with the system file picker, so that I can bring it in from USB, Drive or email without granting storage permissions.
44. As a user, I want the import offered only while the app's cellar is empty, so that it can never merge into or overwrite data I have entered on the phone.
45. As a user, I want the import to be all-or-nothing, so that a bad file never leaves me with half a cellar.
46. As a user, I want a snapshot that is too old, corrupt or not a cellar database to be refused with a clear message, so that I know to take a new snapshot.
47. As a user, I want a summary after a successful import (how many Wines, Producers, Appellations, Meals, Meal Pairings and Consumptions), so that I can check everything came across.
48. As a user, I want imported Wines to keep their quantities, Garde, Consumptions and Meal Pairings exactly as on the backend, so that the phone shows the same cellar.

## Implementation Decisions

### Architecture

- **Single-activity Compose app.** One `MainActivity` (extending `AppCompatActivity`, needed for per-app language on API < 33) hosting a Compose `NavHost`. Routes are the PWA's routes, minus consent and sync: cellar list, history, wine new / detail / edit, manage hub, meal pairings, meals list / new / edit, appellations list / new / edit, producers list / new / edit. Type-safe navigation routes (`@Serializable` route classes).
- **Layers** (all in the `app` module; no multi-module split for now):
  - `domain/`: pure Kotlin, no Android dependency. Garde Status, wine sort (including the status sort), consumption-history sort, filters, pagination, form validation (wine form, name form), error kinds. Ported one-to-one from `web/src/domain/*.ts` and the rules in `internal/db/db.go`.
  - `data/`: Room database, entities, DAOs, and one repository per aggregate (wines, consumptions, producers, appellations, meals, meal pairings). Repositories are the only callers of DAOs and the place where the rules the Go `db` layer enforces are enforced (see "Business rules").
  - `ui/`: one screen composable + one `ViewModel` per screen, exposing a `StateFlow` UI state. Shared components: filter bar (common filters + slot for "ready now"), sort control, paginated list, autocomplete field with "create new", confirm dialog, color swatch, Garde Status badge, rating input.
- **Dependency injection:** manual (an `AppContainer` created in a custom `Application`), no Hilt/Koin. The app is small and single-user; a framework adds build complexity without paying for itself. Revisit if the graph grows.
- **Concurrency:** Kotlin coroutines + Flow. Room DAOs return `Flow` for reads so screens update when data changes (e.g. after a Consumption the cellar list updates without a manual refresh), `suspend` for writes. Multi-step writes (Wine create + initial quantity, Consumption create/delete + quantity change, quantity adjustment) run in `withTransaction`.
- **No network:** no `INTERNET` permission in the manifest, no HTTP client dependency.

### Bootstrap gaps to fill in `android/Oenoteq`

The project is currently an empty AppCompat/Material-views template with no activity. Add:

- Kotlin Compose compiler plugin (`org.jetbrains.kotlin.plugin.compose`), with AGP 9's built-in Kotlin support.
- Compose BOM, `material3`, `ui`, `ui-tooling-preview` / `ui-tooling` (debug), `activity-compose`, `material-icons-extended` if needed.
- `navigation-compose` + `kotlinx-serialization` plugin/runtime for type-safe routes.
- `lifecycle-viewmodel-compose`, `lifecycle-runtime-compose`.
- Room (`room-runtime`, `room-ktx`, `room-compiler` via KSP, `room-testing`) and the KSP plugin, with Room schema export to `app/schemas/` (committed) so migrations can be tested.
- `kotlinx-coroutines-android`, `kotlinx-coroutines-test`.
- Test libraries: JUnit, `androidx.test` (core, runner, ext-junit), Compose UI test (`ui-test-junit4`, `ui-test-manifest`), Robolectric if JVM-side UI tests are wanted.
- Keep `appcompat` (per-app language), drop the Material-views `material` dependency once no XML theme needs it (or keep a minimal `Theme.Material3.DayNight.NoActionBar` parent for the window background).
- Bump `sourceCompatibility`/`targetCompatibility` and the Kotlin JVM target to 17.
- `MainActivity` declared in the manifest as the launcher, edge-to-edge enabled.
- `minSdk` stays 24, `targetSdk`/`compileSdk` stay 37.
- All versions in `gradle/libs.versions.toml`.

### Database (Room)

- **Starting point:** the server schema after migration 006 (`internal/db/migrations/*.sql`), minus what only existed for sync, plus the gaps below. This is Room schema **version 1**; there is no data to migrate into it.
- **Tables:**
  - `appellation(id INTEGER PK, name TEXT NOT NULL UNIQUE)`
  - `producer(id INTEGER PK, name TEXT NOT NULL UNIQUE)`
  - `meal(id INTEGER PK, name TEXT NOT NULL UNIQUE)`
  - `wine(id INTEGER PK, millesime INTEGER NULL, appellation_id INTEGER NOT NULL → appellation, producer_id INTEGER NOT NULL → producer, color TEXT NOT NULL, garde_debut INTEGER NULL, garde_fin INTEGER NULL, quantity INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`
  - `meal_pairing(appellation_id → appellation, color TEXT, meal_id → meal, PK(appellation_id, color, meal_id))`
  - `consumption(id INTEGER PK, wine_id INTEGER NOT NULL → wine, date TEXT NOT NULL (ISO `YYYY-MM-DD`), rating INTEGER NULL, notes TEXT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`
  - `quantity_adjustment(id INTEGER PK AUTOINCREMENT, wine_id INTEGER NOT NULL → wine, delta INTEGER NOT NULL, reason TEXT NOT NULL DEFAULT 'manual', created_at INTEGER NOT NULL)`. Kept as the manual-correction ledger, same meaning as on the server (the initial quantity is its first row, ADR 0007).
- **Dropped:** every `client_id` column and its unique index, and the outbox / id-remap / meta stores from Dexie. With a single local writer there is nothing to make idempotent or reconcile.
- **Kept:** `wine.quantity` as a materialised count, changed only by Consumption create/delete and quantity adjustments, never set from the Wine form (ADR 0001, ADR 0006's "never an absolute write" rule still applies in spirit). `updated_at` kept: cheap, and useful later for an export or "recently changed".
- **Gaps filled compared to the server schema:**
  - **Foreign keys enforced** (Room `ForeignKey`, `onDelete = RESTRICT`), so a referenced Producer/Appellation/Meal/Wine can never be removed even if a repository check is missed. The server only got enforcement late (migration 006).
  - **Indexes on every foreign-key column** (`wine.appellation_id`, `wine.producer_id`, `consumption.wine_id`, `quantity_adjustment.wine_id`, `meal_pairing.meal_id`), which Room requires anyway, plus `consumption.date` for the History's default sort.
  - **`CHECK` constraints are not expressible in Room entities.** Color is a Kotlin `enum class Color { ROUGE, BLANC, ROSE }` stored as `rouge|blanc|rose` through a `TypeConverter`; `quantity >= 0` and rating 1–5 are enforced in repositories and domain validation, and covered by tests.
  - **Timestamps** stored as epoch millis (`INTEGER`) rather than SQLite text timestamps, set by repositories, not by SQL defaults.
- **Migrations:** from version 2 on, every schema change ships a Room `Migration` with a migration test (`MigrationTestHelper` against the exported schema JSON). Never `fallbackToDestructiveMigration`. Per AGENTS.md, a table rebuild follows rename old → create new → copy rows → drop old, with `PRAGMA foreign_keys` handling as in migration 002. App updates must never lose data (story 40).
- **Starts empty.** No seed data. An existing cellar comes in only through the one-time import below.

### One-time import from a backend snapshot

- **Taking the snapshot (backend side, documented in the Android README):** `sqlite3 cellar.db ".backup snapshot.db"`, as `docs/backup-and-restore.md` already does: folds the WAL in, leaves the live database untouched. Run `PRAGMA foreign_key_check` on the snapshot to spot orphan rows ahead of time.
- **Entry point:** an "Import cellar" action, shown in the cellar list's empty state and in the Manage hub, enabled only while every table of the local database is empty. Once anything exists locally it is hidden/disabled.
- **File access:** Storage Access Framework (`ActivityResultContracts.OpenDocument`), no storage permission. The picked file is copied to the app's cache dir, opened with `SQLiteDatabase.openDatabase` (read-write on that private copy: a `.backup` of the backend keeps the WAL flag in its header, and a WAL-mode file can't be opened read-only without its side files; nothing is written), with a no-op error handler so Android doesn't delete a "corrupt" file, and the cache copy deleted afterwards whatever the outcome.
- **Pre-checks, before touching Room** (each failure → a distinct friendly message, nothing written):
  - the file is a SQLite database and `PRAGMA integrity_check` returns `ok` (this also flags rows breaking the backend's own `CHECK`/`NOT NULL` constraints, which are reported as a damaged snapshot);
  - table `schema_version` exists and its last applied migration is `006_fix_consumption_wine_fk.sql` (the accepted snapshot version is pinned to a constant; a snapshot from a newer backend schema is refused too, so a later backend change fails loudly rather than importing wrong data);
  - the local database is still empty.
- **Copy:** in one Room `withTransaction`, table by table in FK order: appellation, producer, meal, wine, meal_pairing, consumption, quantity_adjustment.
  - **Ids are preserved**, so every foreign key stays valid without remapping.
  - `client_id` and `schema_version` are dropped.
  - Text timestamps (`created_at`, `updated_at`) are parsed to epoch millis, leniently (Go driver formats such as `2026-10-16 12:34:56`, RFC 3339 with or without fractional seconds/zone); a null `updated_at` falls back to `created_at`, then to import time. `consumption.date` is normalised to `YYYY-MM-DD`.
  - `wine.quantity` is copied as is, together with the `quantity_adjustment` ledger rows. The import does not recompute quantity from the ledger (Consumptions created before migration 005 have no matching adjustment rows, so a recompute would be wrong).
  - Every row is validated with the same rules as the repositories (valid color, rating null or 1–5, quantity ≥ 0, non-blank unique names, references to existing rows). The first invalid row aborts the transaction with a message naming the table and id.
  - **Orphan rows** (e.g. a consumption whose `wine_id` no longer exists, possible from before migration 006): the import refuses, with the count per table, rather than silently skipping. The fix is to clean the snapshot on the desktop with `sqlite3` and retry; the README gives the `foreign_key_check` command.
- **Result:** a summary screen/dialog with the counts per entity, then the cellar list.
- **Code location:** `data/snapshot/` (`import` is a Kotlin keyword, so not a package name) — a snapshot reader (raw `SQLiteDatabase` → plain Kotlin row classes), a mapper/validator (pure Kotlin, unit-testable), and an importer writing through Room in one transaction. Not reusable for merging; that's deliberate.
- Room's own `createFromFile`/`createFromAsset` are rejected: they require the file to match Room's expected schema exactly (the server schema has `client_id`, `CHECK`s, `DATE`/`TIMESTAMP` text columns), which would need an untested desktop conversion step, and `createFromAsset` would ship personal data inside the APK.

### Business rules (ported from `internal/db/db.go`)

Enforced in repositories, inside a transaction where more than one row changes. Each failure surfaces as a typed domain error mapped to a friendly, localised message (the `errors` catalog of the PWA, minus network errors).

- Wine create: color valid; Appellation and Producer exist; initial quantity ≥ 1 (`initial_quantity_required`); inserts the Wine at quantity 0, then a `quantity_adjustment(delta = initial, reason = manual)` and sets quantity, in one transaction.
- Wine update: same validation; quantity untouched. No Wine delete (the PWA has none).
- Quantity adjustment: signed delta; refused if quantity + delta < 0 (`quantity_zero`).
- Consumption create: date required and valid ISO date; rating null or 1–5; refused if Wine quantity is 0 (`quantity_zero`); decrements quantity by 1 in the same transaction.
- Consumption update: date/rating/notes only, same validation; `wine_id` immutable.
- Consumption delete: removes the row and increments the Wine's quantity by 1 in the same transaction.
- Producer / Appellation / Meal: name required (trimmed, as `domain/nameForm.ts`), unique (`already_exists`). Delete refused if referenced: Producer by a Wine; Appellation by a Wine or a Meal Pairing; Meal by a Meal Pairing (`*_in_use`).
- Meal Pairing add: color valid, Appellation and Meal exist, idempotent (insert-or-ignore). Remove: same checks.
- Referential lists sorted by plain code-unit comparison of names, not locale collation, matching the PWA and server (`web/src/db/sortByName.ts`). In SQL: `ORDER BY name` with SQLite's default `BINARY` collation.

### Queries

- **Cellar list (search):** one Room query over `wine JOIN producer JOIN appellation WHERE quantity > 0`, with optional appellation, color and meal filters. The meal filter uses the same `EXISTS (SELECT 1 FROM meal_pairing …)` clause as the server, so it follows current pairings. Sorting:
  - producer: `producer.name dir, wine.id ASC`
  - appellation: `appellation.name dir, producer.name ASC, wine.id ASC`
  - millesime: NV (null) last in both directions, then `millesime dir, producer.name ASC, wine.id ASC`
  - status: computed in Kotlin after the query: Garde Status rank (`too_young`, `ready`, `past_peak`, `unassessed`) in the requested direction, then `garde_debut` in the same direction (unset last), then producer name, then id.
  - Garde Status and the "ready now" filter computed in Kotlin with the current year, from `domain/gardeStatus`.
  - Dynamic filter/sort combinations go through `@RawQuery` with a `SupportSQLiteQuery` built in one place, or through a fixed query with nullable-parameter filters (`:appellationId IS NULL OR …`) and in-Kotlin sorting. The implementer picks one; both must pass the same sort/filter tests.
- **Consumption History:** `consumption JOIN wine JOIN producer JOIN appellation`, same filters (no "ready now", no quantity filter), sort axes producer / appellation / millesime / date, default date desc. Ties: on equal date, higher consumption id first; on any other axis, date desc then id desc; NV last for millesime. Exactly the server's `sortConsumptionHistorySQL`.
- **Pagination:** client-side slicing of the full result, 10 per page, as `web/src/domain/pagination.ts`. Results are small (hundreds of rows), as ADR 0009 already reasons.
- **Wine detail:** Wine + producer, suggested Meals (pairing on the Wine's appellation and color, sorted by name), Consumptions ordered by `date, id`.

### UI behaviour carried over from the PWA

- Filter bar shared by cellar list and History, with "ready now" as cellar-only extra content; filter count; clear filters; on narrow screens a bottom sheet for filters and for sort.
- List state (filters, sort, page) held in the screen's `SavedStateHandle`, so it survives back navigation, rotation and process death. Scroll position restored when returning from detail.
- Success message after a save (Snackbar), and changed values highlighted on the screen the user lands on (`useHighlight` behaviour).
- Confirm dialog before every delete.
- Bottom navigation (Material pattern): each area keeps its own back stack; tapping another tab returns to where that area was left, tapping the selected tab returns to its top screen (cellar list, History, Manage hub). A Wine opened from the cellar list or the History stays in that area (each area declares its own route types for the Wine detail, edit and pairing screens).
- Autocomplete fields for Appellation, Producer and Meal (pairing screen) with keyboard/IME-friendly filtering and a "create new" entry when the text matches nothing exactly.
- Empty states and friendly errors as in the PWA; no "can't reach the server" state exists any more.
- Color shown as a swatch / rail as in the PWA; visual design follows Material 3 with the PWA's palette (burgundy / gold / parchment) as the theme's seed colors. Pixel parity with the PWA is not a goal; feature parity is.

### Localisation

- `res/values/strings.xml` (English, default) and `res/values-fr/strings.xml` (French), translated from `web/src/i18n/messages/{en,fr}/*` with the vocabulary in `docs/i18n-vocabulary.md`. Plurals through `<plurals>`.
- Initial language: French if the device's first preferred language is French, English otherwise (same as `resolveLocale`). In-app switch through `AppCompatDelegate.setApplicationLocales`, with `android:localeConfig` (`res/xml/locales_config.xml`) and the `AppLocalesMetadataHolderService` (`autoStoreLocales = true`) so the choice persists on API < 33.
- Dates through `java.time` (available on minSdk 24 with core library desugaring enabled) formatted with the current locale.

### Backup

- Keep `android:allowBackup="true"`. Fill `data_extraction_rules.xml` (API 31+) and `backup_rules.xml` (API ≤ 30) so the Room database is included in both cloud backup and device-to-device transfer. Nothing else is backed up (no shared preferences needed beyond the locale, which AppCompat stores itself).
- Accepted risk: Auto Backup runs at Android's discretion (roughly daily, on Wi-Fi and charging), so the last day of changes can be lost. A manual export/import is out of scope for now.

### Docs and decisions

- **New ADR 0012:** "Native Android client is local-only, separate from the PWA and backend". Records: no sync to the Go backend; Android Auto Backup as the only safety net; Kotlin/Compose/Room single-activity; manual DI; Cookie Consent, Offline Mode and Change to Sync do not apply to the Android app; two codebases accepted, kept in step by porting domain rules with their tests.
- **`CONTEXT.md`:** add a short note that Cookie Consent, Offline Mode and Change to Sync are PWA-only concepts; all other terms (Wine, Producer, Consumption, Consumption History, Millesime, Garde, Garde Status, Appellation, Color, Meal, Meal Pairing) apply to the Android app unchanged.
- `android/Oenoteq/README.md`: build, run, test commands.

## Testing Decisions

- Good tests check behaviour seen from outside a unit: what a repository returns or refuses, what a screen shows and what tapping does. They don't assert on DAO calls or ViewModel internals.
- **Domain (JVM unit tests):** Garde Status, wine sort (all axes, both directions, tie-breaks, status sort), consumption-history sort, pagination, wine form and name form validation. Port the cases from the matching `web/src/domain/*.test.ts` files so both apps are held to the same rules.
- **Repositories (Room in-memory DB, instrumented or Robolectric):** every rule in "Business rules", including quantity never going below 0, Consumption create/delete adjusting quantity, Wine create writing the initial quantity adjustment, `*_in_use` and `already_exists` refusals, foreign keys rejecting orphans. Search and Consumption History queries: each filter alone and combined, meal filter following current pairings, quantity-0 Wines excluded from search and included in history, every sort axis and its fallback. Port cases from `internal/handlers/*_test.go` and `testdata/search-fixtures.json`.
- **Migrations:** from schema version 2 on, a `MigrationTestHelper` test per migration, opening the previous version with rows in it and checking they survive.
- **Screens (Compose UI tests):** one tracer per main flow, working on a real in-memory DB: add a Wine (with create-new producer/appellation) and see it in the list; record a Consumption and see quantity drop and the History gain a row; filter and sort the cellar list and come back from detail to the same state; refuse deleting an in-use Producer with the friendly message; create a Meal from the pairing screen and see it paired; switch language and see French labels.
- **One-time import:** a fixture snapshot built by running the real Go migrations 001–006 (via the Go test harness or a small `go run` helper) and inserting a known cellar, including a Wine at quantity 0, NV Wines, unassessed garde, Consumptions with and without rating/notes, and Meal Pairings; committed as a binary test fixture with the script that regenerates it. Tests: import into an empty in-memory Room DB and check counts, quantities, a cellar search and a Consumption History result match the backend's; ids preserved; refusal when the local DB is not empty, when `schema_version` is older or newer than 006, on a non-SQLite file, on orphan rows, and on an invalid row — each leaving the local DB empty. Timestamp parsing gets its own unit tests over the formats listed above.
- **Strings:** a unit test that `values` and `values-fr` declare the same keys (counterpart of `catalogParity.test.ts`).

## Out of Scope

- Any sync or backup with the Go backend or the PWA. The only bridge is the one-time snapshot import into an empty cellar; no repeated import, merge, or export back to the backend.
- Manual export of the database to a file, and import into a non-empty cellar.
- Label Scan (kept for later; on Android, on-device ML Kit Text Recognition is the likely route, which keeps ADR 0004's "photo never leaves the device").
- Cookie Consent, Offline Mode, sync status page, Changes to Sync, PWA update flow.
- Wine delete (the PWA has none).
- Tablet/foldable-specific layouts beyond what adaptive Compose gives for free.
- Play Store publishing, signing config, CI for the Android app.
- Changes to the PWA or Go backend.

## Further Notes

- Suggested ticket order, each a vertical slice that runs on a device:
  1. Bootstrap: dependencies, `MainActivity`, theme, `NavHost` with empty Cellar / History / Manage destinations and bottom navigation, `AppContainer`, Room DB v1 with all entities and schema export, backup rules, strings scaffolding en/fr + parity test.
  2. One-time import from a backend snapshot (reader, mapper/validator, importer, fixture + tests), with a temporary entry point on the empty cellar placeholder. Doing it early gives real data for manual testing of every later ticket.
  3. Producers, Appellations, Meals: list / add / rename / delete with uniqueness and in-use rules, Manage hub (incl. its "Import cellar" entry).
  4. Wine add + cellar list (no filters yet, with the import action in its empty state) + Wine detail + edit, with initial quantity and create-new autocompletes.
  5. Cellar list filters, sort (incl. status), "ready now", pagination, state restoration.
  6. Consumption record / edit / delete and quantity adjustment on Wine detail.
  7. Meal Pairing screen (incl. auto-pair on create) and suggested Meals on Wine detail, meal filter.
  8. Consumption History screen.
  9. In-app language switch, success messages and highlight, friendly errors pass, empty states.
  10. ADR 0012, `CONTEXT.md` note, Android README (incl. how to take and check the snapshot).
  Tickets 2, 3 and 4 depend on 1; 5–8 depend on 4 (7 on 3 as well); 9 can follow any time after 4.
- The PWA's `.scratch/*` specs remain the reference for detailed behaviour (e.g. `.scratch/consumption-history/spec.md`, `.scratch/real-world-feedback/*`); where this spec is silent, match the PWA.
