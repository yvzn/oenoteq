#!/bin/sh
# Export the production database to a local SQLite file. READ-ONLY: production is not touched.
# Needs: az CLI logged in, docker. sqlite3 is optional (used for an integrity check).
#
#   sh infra/export-db.sh [path/to/output.db]
#
# Restores the latest Litestream replica from Blob in a throwaway container and copies the file out.
# The result lags production by about a second of WAL (more if the app scaled to zero and the last
# sync was earlier). Set TIMESTAMP=2026-10-07T15:00:00Z (UTC) for a point-in-time export.
# See docs/backup-and-restore.md.
set -eu

OUT="${1:-cellar-export-$(date -u +%Y%m%dT%H%M%SZ).db}"
RG="${RG:-cellar-rg}"
CONTAINER="${LITESTREAM_AZURE_CONTAINER:-backups}"
PREFIX="${LITESTREAM_AZURE_PATH:-cellar}"
IMAGE="litestream/litestream:0.3.13"
DIR="$(dirname "$0")"
NAME="cellar-export-$$"

[ ! -e "$OUT" ] || { echo "refusing to overwrite: $OUT" >&2; exit 1; }

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

ACCOUNT="$(az storage account list -g "$RG" --query '[0].name' -o tsv)"
KEY="$(az storage account keys list -g "$RG" -n "$ACCOUNT" --query '[0].value' -o tsv)"

echo "Exporting $ACCOUNT/$CONTAINER/$PREFIX to $OUT."

# Latest replica, or a point in time when TIMESTAMP is set.
if [ -n "${TIMESTAMP:-}" ]; then
  set -- restore -config /etc/litestream.yml -timestamp "$TIMESTAMP" -o /tmp/export.db /tmp/cellar.db
else
  set -- restore -config /etc/litestream.yml -o /tmp/export.db /tmp/cellar.db
fi

# docker cp, not a bind mount: avoids Windows volume problems (same approach as seed-db.sh).
docker create --name "$NAME" --user 0 \
  -e DB_PATH=/tmp/cellar.db \
  -e LITESTREAM_AZURE_ACCOUNT_NAME="$ACCOUNT" \
  -e LITESTREAM_AZURE_ACCOUNT_KEY="$KEY" \
  -e LITESTREAM_AZURE_CONTAINER="$CONTAINER" \
  -e LITESTREAM_AZURE_PATH="$PREFIX" \
  -e LITESTREAM_AZURE_ENDPOINT= \
  "$IMAGE" "$@" >/dev/null
TMP="$(mktemp -d)"
trap 'cleanup; rm -rf "$TMP"' EXIT
cp "$DIR/../webapp/docker/litestream.yml" "$TMP/litestream.yml"
tar -C "$TMP" --owner=0 --group=0 -cf - litestream.yml | docker cp - "$NAME:/etc"

# Foreground: -a streams restore output and waits for it to finish.
docker start -a "$NAME" || { echo "litestream restore failed (no replica under $PREFIX/?)" >&2; exit 1; }

docker cp "$NAME:/tmp/export.db" "$OUT"

if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$OUT" "PRAGMA integrity_check;" | grep -qx ok || { echo "integrity_check failed on $OUT" >&2; exit 1; }
  echo "integrity_check ok."
else
  echo "sqlite3 not found, integrity check skipped."
fi

echo "Done: $OUT"
