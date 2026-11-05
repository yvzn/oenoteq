# Backup and restore (Litestream to Azure Blob)

The container image (`webapp/Dockerfile`) starts via `webapp/docker/entrypoint.sh`. Litestream is **off** unless `LITESTREAM_AZURE_ACCOUNT_NAME` is set, so the Windows exe and plain `docker run` behave as before.

## Configuration

| Env var | Required | Meaning |
|---|---|---|
| `LITESTREAM_AZURE_ACCOUNT_NAME` | enables Litestream | Storage account name |
| `LITESTREAM_AZURE_ACCOUNT_KEY` | yes | Storage account key (use a secret) |
| `LITESTREAM_AZURE_CONTAINER` | yes | Blob container holding replicas |
| `LITESTREAM_AZURE_PATH` | no (`cellar`) | Prefix inside the container |
| `LITESTREAM_AZURE_ENDPOINT` | no | Override, e.g. Azurite `http://host:10000/devstoreaccount1` |

## Behaviour

1. Start: if `DB_PATH` does not exist and a replica exists, restore latest. No replica (first ever start) = start empty.
2. Run: `litestream replicate -exec /cellar`; WAL replicates about every second. Litestream forwards signals and exits with the app's exit code.

Keep max replicas = 1 (single writer).

## Manual restore

Needs the `litestream` CLI (v0.3.x) and the same env vars. Config: `webapp/docker/litestream.yml`.

```sh
export DB_PATH=/tmp/restored.db LITESTREAM_AZURE_PATH=cellar LITESTREAM_AZURE_ENDPOINT=
litestream restore -config webapp/docker/litestream.yml "$DB_PATH"
```

## Export the production DB

Gets a plain SQLite `.db` file of production onto your machine. Read-only: the app and the replica are not touched. Needs `az` (logged in) and `docker`; `sqlite3` is optional (integrity check).

```sh
sh infra/export-db.sh                      # writes cellar-export-<UTC timestamp>.db
sh infra/export-db.sh path/to/prod.db      # explicit output (never overwrites an existing file)
TIMESTAMP=2026-10-07T15:00:00Z sh infra/export-db.sh   # point-in-time export (UTC, within retention)
```

The script:

1. Looks up the storage account and its key with `az` (the same key the app gets as the `storage-key` secret).
2. Runs a throwaway `litestream/litestream:0.3.13` container that restores the replica to a file, copies it out with `docker cp`, removes the container.
3. Runs `PRAGMA integrity_check` on the result when `sqlite3` is available.

Env overrides: `RG` (`cellar-rg`), `LITESTREAM_AZURE_CONTAINER` (`backups`), `LITESTREAM_AZURE_PATH` (`cellar`).

The export comes from Blob, not the live container: it lags by about a second of WAL, and if the app is scaled to zero it reflects the last sync before shutdown. It is a single file (no `-wal`/`-shm`), so open it directly with `sqlite3` or point `DB_PATH` at it for a local run. It contains real user data: keep it out of the repo and delete it when done.

Without Docker: install the `litestream` 0.3.x CLI, export `LITESTREAM_AZURE_ACCOUNT_NAME`, `LITESTREAM_AZURE_ACCOUNT_KEY`, `LITESTREAM_AZURE_CONTAINER`, `LITESTREAM_AZURE_PATH` and an empty `LITESTREAM_AZURE_ENDPOINT`, then use the commands in Manual restore with `-o <file>`.

## Point-in-time recovery

Retention is 7 days (`retention: 168h`, snapshot every 24h in `webapp/docker/litestream.yml`). Litestream deletes older snapshots and WAL itself, so no manual cleanup; nothing older than 7 days can be restored. For a backstop, add an Azure Blob lifecycle rule in the infra ticket (04).

List generations and snapshots:

```sh
litestream generations -config webapp/docker/litestream.yml "$DB_PATH"
litestream snapshots -config webapp/docker/litestream.yml "$DB_PATH"
```

Restore to a moment (UTC) or a specific generation/index:

```sh
litestream restore -config webapp/docker/litestream.yml -timestamp 2026-10-07T15:00:00Z -o /tmp/pitr.db "$DB_PATH"
litestream restore -config webapp/docker/litestream.yml -generation <id> -index <n> -o /tmp/pitr.db "$DB_PATH"
```

To roll production back, never delete the existing prefix (it holds the other restore points). Restore the wanted state to a file as above, then verify it with `sqlite3 /tmp/pitr.db "select count(*) from wine"`. Then either re-upload that file to a **new** `LITESTREAM_AZURE_PATH` (run a throwaway container with the file at `DB_PATH` and Litestream pointed at the new prefix, let it replicate) and switch the app's `LITESTREAM_AZURE_PATH` to it, or keep the old prefix and restore with `-timestamp` into a new prefix the same way.

Note: the config sets `endpoint` to an empty string when `LITESTREAM_AZURE_ENDPOINT` is unset, relying on Litestream falling back to `https://<account>.blob.core.windows.net`. Verified only against Azurite; confirm on real Azure in the infra ticket (04). Auth is account-key only (Litestream 0.3.x `abs`); managed identity is not supported by this version.

## Seed production from a local database

Replaces production data with a local SQLite file (first import, or throwing away test data). Needs `az` (logged in), `docker`, `sqlite3`.

```sh
sh infra/seed-db.sh path/to/cellar.db
```

The script asks for confirmation, then:

1. Copies the file with `sqlite3 .backup` (WAL folded in, source untouched) and checks `integrity_check`.
2. Scales the app to 0 replicas (single writer).
3. **Deletes every blob under the replica prefix** (`backups/cellar/*`).
4. Runs a throwaway Litestream container with the copy, waits for the first snapshot blob, stops it.
5. Scales the app back to `max=1`. The next cold start restores the seeded DB (empty disk, replica exists).

Env overrides: `RG` (`cellar-rg`), `APP` (`cellar-app`), `LITESTREAM_AZURE_CONTAINER` (`backups`), `LITESTREAM_AZURE_PATH` (`cellar`).

Do not use it while production holds data you want to keep: use a new `LITESTREAM_AZURE_PATH` and switch the app to it instead (see Point-in-time recovery). A local DB newer than the deployed image's migrations will not start; deploy the matching image first.

## Local test with Azurite

Run `mcr.microsoft.com/azure-storage/azurite azurite-blob --blobHost 0.0.0.0` on a docker network, create container `backups` with the well-known dev key, run the image with the env vars above and `LITESTREAM_AZURE_ENDPOINT=http://<azurite>:10000/devstoreaccount1`. Write data, `docker kill`, start a new container: data is restored.
