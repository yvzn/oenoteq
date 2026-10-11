#!/bin/sh
# Provision (or update) Cellar on Azure Container Apps. Repeatable.
# Needs: az CLI logged in (`az login`), subscription selected.
#
#   IMAGE=ghcr.io/yvzn/oenoteq:latest ALLOWED_OIDS="<oid1> <oid2>" sh infra/deploy.sh
#
# ALLOWED_OIDS: Entra object ids of the personal accounts allowed in. Leave empty for the
# spike's first run (no restriction), then set it. See docs/azure-deployment.md.
set -eu

RG="${RG:-cellar-rg}"
LOCATION="${LOCATION:-westeurope}"
APP_REG_NAME="${APP_REG_NAME:-cellar-easyauth}"
IMAGE="${IMAGE:?set IMAGE, e.g. ghcr.io/yvzn/oenoteq:latest}"
ALLOWED_OIDS="${ALLOWED_OIDS:-}"
DIR="$(dirname "$0")"

az group create -n "$RG" -l "$LOCATION" -o none

# App registration: personal Microsoft accounts only. Reuse if it exists.
CLIENT_ID="$(az ad app list --display-name "$APP_REG_NAME" --query '[0].appId' -o tsv)"
if [ -z "$CLIENT_ID" ]; then
  CLIENT_ID="$(az ad app create --display-name "$APP_REG_NAME" \
    --sign-in-audience PersonalMicrosoftAccount --query appId -o tsv)"
fi
# New secret each run. Without --append, reset replaces existing secrets (Entra allows only 2).
CLIENT_SECRET="$(az ad app credential reset --id "$CLIENT_ID" \
  --display-name "easyauth-$(date +%Y%m%d)" --years 1 --query password -o tsv)"

IDENTITIES="[]"
if [ -n "$ALLOWED_OIDS" ]; then
  IDENTITIES="[$(printf '"%s",' $ALLOWED_OIDS | sed 's/,$//')]"
fi

FQDN="$(az deployment group create -g "$RG" -f "$DIR/main.bicep" \
  -p image="$IMAGE" clientId="$CLIENT_ID" clientSecret="$CLIENT_SECRET" \
     allowedIdentities="$IDENTITIES" \
  --query properties.outputs.fqdn.value -o tsv)"

# Redirect URI needs the FQDN, only known after the first deploy.
az ad app update --id "$CLIENT_ID" \
  --web-redirect-uris "https://$FQDN/.auth/login/aad/callback" \
  --enable-id-token-issuance true

echo "Deployed: https://$FQDN"
