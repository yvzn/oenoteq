#!/bin/sh
set -eu

# Without Litestream config the app starts exactly as before.
if [ -z "${LITESTREAM_AZURE_ACCOUNT_NAME:-}" ]; then
  exec /cellar
fi

: "${LITESTREAM_AZURE_ACCOUNT_KEY:?required when LITESTREAM_AZURE_ACCOUNT_NAME is set}"
: "${LITESTREAM_AZURE_CONTAINER:?required when LITESTREAM_AZURE_ACCOUNT_NAME is set}"
export LITESTREAM_AZURE_PATH="${LITESTREAM_AZURE_PATH:-cellar}"
export LITESTREAM_AZURE_ENDPOINT="${LITESTREAM_AZURE_ENDPOINT:-}"

# Restore only on empty disk; no replica yet (first ever start) means start empty.
litestream restore -config /etc/litestream.yml -if-db-not-exists -if-replica-exists "$DB_PATH"

exec litestream replicate -config /etc/litestream.yml -exec /cellar
