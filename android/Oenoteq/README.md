# Oenoteq — Android

Native Android version of the wine cellar tracker. Same features as the PWA, but the cellar lives only in a SQLite database on the phone (Room). No network, no sync. Android Auto Backup copies the database to the user's Google account. Spec: `.scratch/android-port/spec.md`.

Kotlin, Jetpack Compose (Material 3), Room, Navigation Compose. Single activity, manual dependency wiring (`AppContainer`).

## Requirements

- JDK 17+ (the Gradle daemon toolchain is set to 25)
- Android SDK with platform 37, pointed to by `local.properties` (`sdk.dir=...`, written by Android Studio)
- For device tests: an emulator or a phone with USB debugging

## Build and run

From `android/Oenoteq/`:

```sh
./gradlew assembleDebug          # app/build/outputs/apk/debug/app-debug.apk
./gradlew installDebug           # on the connected device/emulator
```

## Tests

```sh
./gradlew testDebugUnitTest          # JVM: domain, repositories and snapshot import (Robolectric), strings parity
./gradlew connectedDebugAndroidTest  # on a device: app shell, cellar/wine/manage flows, import on the device's SQLite
```

The cellar search runs the same `testdata/search-fixtures.json` cases as the Go backend and the PWA (`CellarSearchTest`), so a change to search or sort rules lands in all three.

Device tests empty the app's database before each test: don't run them on a device holding a cellar you care about.

On a fresh emulator, unlock the screen first (`adb shell wm dismiss-keyguard`) or the UI tests can't see the app.

## Database

- Schema JSON is exported to `app/schemas/` and committed.
- Every schema change bumps the Room version and ships a `Migration` and a migration test. Never use destructive migration: real cellars live in this file. Table rebuilds follow AGENTS.md (rename old → create new → copy rows → drop old).

## Importing the cellar from the backend (one time)

The app can take over an existing cellar from the Go backend once, into an empty cellar only.

1. On the machine running the backend, take a consistent copy of the database. This folds in the WAL and leaves the live file untouched:

   ```sh
   sqlite3 cellar.db ".backup snapshot.db"
   ```

2. Optional: check for orphan rows, which the import refuses. An empty output means none:

   ```sh
   sqlite3 snapshot.db "PRAGMA foreign_key_check"
   ```

3. Copy `snapshot.db` to the phone (USB, Drive, email…).
4. In the app, on the empty cellar screen, tap **Import cellar** and pick the file.

The import is all or nothing and keeps ids, quantities, Garde, Consumptions and Meal Pairings as they are. It only accepts a snapshot whose last backend migration is `006_fix_consumption_wine_fk.sql` (`SnapshotReader.SUPPORTED_BACKEND_MIGRATION`). When the backend schema changes, update the reader and the fixture together.

### Test fixture

`app/src/test/resources/snapshot/backend-snapshot.db` is written by the real backend code. Regenerate it from the repo root:

```sh
go run ./android/Oenoteq/tools/snapshotfixture android/Oenoteq/app/src/test/resources/snapshot/backend-snapshot.db
```

The expected contents are asserted in `SnapshotImporterTest`; change both together.
