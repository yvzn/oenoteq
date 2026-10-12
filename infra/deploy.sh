#!/bin/sh
# Provision (or update) Cellar on Azure Container Apps. Repeatable.
# Needs: az CLI logged in (`az login`), subscription selected.
#
#   IMAGE=ghcr.io/yvzn/oenoteq:latest sh infra/deploy.sh
#
# Access is limited to the signed-in tenant (single-tenant app registration, tenant issuer).
set -eu

RG="${RG:-cellar-rg}"
LOCATION="${LOCATION:-westeurope}"
APP_REG_NAME="${APP_REG_NAME:-cellar-easyauth}"
IMAGE="${IMAGE:?set IMAGE, e.g. ghcr.io/yvzn/oenoteq:latest}"
DIR="$(dirname "$0")"

az group create -n "$RG" -l "$LOCATION" -o none

# App registration: current tenant only. Reuse if it exists.
CLIENT_ID="$(az ad app list --display-name "$APP_REG_NAME" --query '[0].appId' -o tsv)"
if [ -z "$CLIENT_ID" ]; then
  CLIENT_ID="$(az ad app create --display-name "$APP_REG_NAME" \
    --sign-in-audience AzureADMyOrg --query appId -o tsv)"
else
  # Migrates a registration created earlier for personal accounts.
  az ad app update --id "$CLIENT_ID" --sign-in-audience AzureADMyOrg
fi
# New secret each run. Without --append, reset replaces existing secrets (Entra allows only 2).
CLIENT_SECRET="$(az ad app credential reset --id "$CLIENT_ID" \
  --display-name "easyauth-$(date +%Y%m%d)" --years 1 --query password -o tsv)"

FQDN="$(az deployment group create -g "$RG" -f "$DIR/main.bicep" \
  -p image="$IMAGE" clientId="$CLIENT_ID" clientSecret="$CLIENT_SECRET" \
  --query properties.outputs.fqdn.value -o tsv)"

# Redirect URI needs the FQDN, only known after the first deploy.
az ad app update --id "$CLIENT_ID" \
  --web-redirect-uris "https://$FQDN/.auth/login/aad/callback" \
  --enable-id-token-issuance true

echo "Deployed: https://$FQDN"
