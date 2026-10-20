#!/bin/sh
# Replace the production database with a local SQLite file. DESTRUCTIVE: wipes the existing replica.
# Needs: az CLI logged in, docker, sqlite3.
#
#   sh infra/seed-db.sh path/to/cellar.db
#
# Stops the app, deletes the Litestream replica prefix, uploads the file as a new replica, restarts
# the app. The app restores it from Blob on cold start (docs/backup-and-restore.md).
set -eu

SRC="${1:?usage: sh infra/seed-db.sh path/to/cellar.db}"
RG="${RG:-cellar-rg}"
APP="${APP:-cellar-app}"
CONTAINER="${LITESTREAM_AZURE_CONTAINER:-backups}"
PREFIX="${LITESTREAM_AZURE_PATH:-cellar}"
IMAGE="litestream/litestream:0.3.13"
DIR="$(dirname "$0")"
NAME="cellar-seed-$$"
TMP="$(mktemp -d)"

[ -f "$SRC" ] || { echo "not a file: $SRC" >&2; exit 1; }

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

ACCOUNT="$(az storage account list -g "$RG" --query '[0].name' -o tsv)"
KEY="$(az storage account keys list -g "$RG" -n "$ACCOUNT" --query '[0].value' -o tsv)"

echo "Seeding $ACCOUNT/$CONTAINER/$PREFIX from $SRC (app $APP in $RG)."
printf "This deletes the current production data. Type 'yes' to continue: "
read -r ANSWER
[ "$ANSWER" = "yes" ] || { echo "aborted"; exit 1; }

# Consistent single-file copy (WAL folded in). The source file is left untouched.
sqlite3 "$SRC" ".backup '$TMP/cellar.db'"
sqlite3 "$TMP/cellar.db" "PRAGMA integrity_check;" | grep -qx ok || { echo "integrity_check failed" >&2; exit 1; }

# Single writer: nothing may replicate while the prefix is replaced.
az containerapp update -g "$RG" -n "$APP" --min-replicas 0 --max-replicas 0 -o none
az storage blob delete-batch --account-name "$ACCOUNT" --account-key "$KEY" \
  -s "$CONTAINER" --pattern "$PREFIX/*" -o none

# docker cp, not a bind mount: avoids Windows volume and SQLite locking problems.
docker create --name "$NAME" \
  -e DB_PATH=/tmp/cellar.db \
  -e LITESTREAM_AZURE_ACCOUNT_NAME="$ACCOUNT" \
  -e LITESTREAM_AZURE_ACCOUNT_KEY="$KEY" \
  -e LITESTREAM_AZURE_CONTAINER="$CONTAINER" \
  -e LITESTREAM_AZURE_PATH="$PREFIX" \
  -e LITESTREAM_AZURE_ENDPOINT= \
  "$IMAGE" replicate -config /etc/litestream.yml >/dev/null
docker cp "$TMP/cellar.db" "$NAME:/tmp/cellar.db"
docker cp "$DIR/../docker/litestream.yml" "$NAME:/etc/litestream.yml"
docker start "$NAME" >/dev/null

# Wait for the first snapshot blob, then stop (SIGTERM lets Litestream finish syncing).
echo "Waiting for snapshot upload..."
i=0
until [ "$(az storage blob list --account-name "$ACCOUNT" --account-key "$KEY" -c "$CONTAINER" \
    --prefix "$PREFIX/" --query "[?contains(name, '/snapshots/')] | length(@)" -o tsv)" -gt 0 ]; do
  i=$((i + 1))
  [ "$i" -le 30 ] || { docker logs "$NAME" >&2; echo "no snapshot after 150s" >&2; exit 1; }
  sleep 5
done
docker stop "$NAME" >/dev/null

az containerapp update -g "$RG" -n "$APP" --min-replicas 0 --max-replicas 1 -o none
echo "Done. App restores the seeded DB on next cold start."
