# Oenoteq — Android

Native Android version of the wine cellar tracker. Same features as the PWA, but the cellar lives only in a SQLite database on the phone (Room). No network, no sync. Android Auto Backup copies the database to the user's Google account. Decision: [ADR 0012](../../docs/adr/0012-android-client-local-only.md). Spec: `.scratch/android-port/spec.md`.

Kotlin, Jetpack Compose (Material 3), Room, Navigation Compose. Single activity, manual dependency wiring (`AppContainer`).

## Layout

- `domain/`: pure Kotlin rules ported from `webapp/web/src/domain` (Garde Status, cellar search and sort, Consumption History order, pagination, form rules) and `CellarError`, one code per refusal of the Go `db` layer.
- `data/`: Room entities and DAOs, one repository per aggregate (the only callers of the DAOs, where the backend's rules are enforced), and `data/snapshot/`, the one-time import.
- `ui/`: one screen and ViewModel per destination. `OenoteqApp.kt` holds the routes: one nested graph per bottom-bar tab, each with its own back stack. `components/` holds the shared pieces (filter bar, sort sheet, pager, autocomplete, highlight, language toggle).

What the app shares with the PWA's UX:

- **Bottom bar.** Tapping another tab returns to where you left it. Tapping the selected tab goes back to its top screen.
- **Confirmations.** A change you can see on screen is highlighted until you leave the screen. Any other change shows a message at the bottom, one at a time, that stays until dismissed and is dropped when you navigate. A message confirming a save stays on the page the save lands on.
- **Language.** `FR | EN` in the top bar of Cellar, History and Manage. The first language follows the phone (French if French, English otherwise).

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

## Release APK (CI)

Pushing a `v*` tag makes the Release workflow's `android` job build a signed, minified APK and attach it to the GitHub Release as `oenoteq-<tag>.apk` (sideload it: allow "install unknown apps"). `versionName` is the tag, `versionCode` is `MAJOR*10000 + MINOR*100 + PATCH`, so tags must be `vMAJOR.MINOR.PATCH`.

Signing comes from repository secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Create the keystore once and **keep it**: a different key later cannot update an installed app.

```sh
keytool -genkeypair -v -keystore release.jks -alias oenoteq -keyalg RSA -keysize 4096 -validity 10000
base64 -w0 release.jks   # value of ANDROID_KEYSTORE_BASE64
```

Local `./gradlew assembleRelease` without `ANDROID_KEYSTORE_FILE` produces an unsigned APK.

### Installing the release APK

Download `oenoteq-<tag>.apk` from the GitHub Release, then either:

**With adb** (phone connected by USB, or paired over Wi-Fi):

1. On the phone: Settings → About phone → tap Build number 7 times, then Settings → Developer options → enable USB debugging.
2. Connect the phone and accept the "Allow USB debugging" prompt. Check it shows as `device`:

   ```sh
   adb devices
   ```

3. Install:

   ```sh
   adb install oenoteq-v1.2.3.apk
   ```

   To update an installed copy, keep the data and replace it with `adb install -r oenoteq-v1.2.3.apk`. It only works if both APKs are signed with the same key and the new `versionCode` is not lower. With several devices attached, add `-s <serial>` (serial from `adb devices`).

**Without adb:** copy the APK to the phone (USB, Drive, email), open it from a file manager and allow "Install unknown apps" for that app when Android asks.

Uninstalling the app deletes the cellar. Export it from the Manage hub first.

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

`app/src/test/resources/snapshot/backend-snapshot.db` is written by the real backend code. Regenerate it from `webapp/` (the generator, `webapp/tools/snapshotfixture`, imports the backend `db` package):

```sh
go run ./tools/snapshotfixture ../android/Oenoteq/app/src/test/resources/snapshot/backend-snapshot.db
```

The expected contents are asserted in `SnapshotImporterTest`; change both together.
