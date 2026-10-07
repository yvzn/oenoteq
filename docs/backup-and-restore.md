# Backup and restore (Litestream to Azure Blob)

The container image (`Dockerfile`) starts via `docker/entrypoint.sh`. Litestream is **off** unless `LITESTREAM_AZURE_ACCOUNT_NAME` is set, so the Windows exe and plain `docker run` behave as before.

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

Needs the `litestream` CLI (v0.3.x) and the same env vars. Config: `docker/litestream.yml`.

```sh
export DB_PATH=/tmp/restored.db LITESTREAM_AZURE_PATH=cellar LITESTREAM_AZURE_ENDPOINT=
litestream restore -config docker/litestream.yml "$DB_PATH"
```

## Point-in-time recovery

Retention is 7 days (`retention: 168h`, snapshot every 24h in `docker/litestream.yml`). Litestream deletes older snapshots and WAL itself, so no manual cleanup; nothing older than 7 days can be restored. For a backstop, add an Azure Blob lifecycle rule in the infra ticket (04).

List generations and snapshots:

```sh
litestream generations -config docker/litestream.yml "$DB_PATH"
litestream snapshots -config docker/litestream.yml "$DB_PATH"
```

Restore to a moment (UTC) or a specific generation/index:

```sh
litestream restore -config docker/litestream.yml -timestamp 2026-10-07T15:00:00Z -o /tmp/pitr.db "$DB_PATH"
litestream restore -config docker/litestream.yml -generation <id> -index <n> -o /tmp/pitr.db "$DB_PATH"
```

To roll production back, never delete the existing prefix (it holds the other restore points). Restore the wanted state to a file as above, then verify it with `sqlite3 /tmp/pitr.db "select count(*) from wine"`. Then either re-upload that file to a **new** `LITESTREAM_AZURE_PATH` (run a throwaway container with the file at `DB_PATH` and Litestream pointed at the new prefix, let it replicate) and switch the app's `LITESTREAM_AZURE_PATH` to it, or keep the old prefix and restore with `-timestamp` into a new prefix the same way.

Note: the config sets `endpoint` to an empty string when `LITESTREAM_AZURE_ENDPOINT` is unset, relying on Litestream falling back to `https://<account>.blob.core.windows.net`. Verified only against Azurite; confirm on real Azure in the infra ticket (04). Auth is account-key only (Litestream 0.3.x `abs`); managed identity is not supported by this version.

## Local test with Azurite

Run `mcr.microsoft.com/azure-storage/azurite azurite-blob --blobHost 0.0.0.0` on a docker network, create container `backups` with the well-known dev key, run the image with the env vars above and `LITESTREAM_AZURE_ENDPOINT=http://<azurite>:10000/devstoreaccount1`. Write data, `docker kill`, start a new container: data is restored.
