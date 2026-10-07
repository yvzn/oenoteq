#!/bin/sh
# One-time: let GitHub Actions deploy to Azure via OIDC federated credentials (no stored secret).
# Needs: az CLI logged in as an owner of the subscription.
#
#   GITHUB_REPO=yvzn/oenoteq sh infra/setup-github-oidc.sh
#
# Prints the three values to store as GitHub repo variables (not secrets).
set -eu

GITHUB_REPO="${GITHUB_REPO:?set GITHUB_REPO, e.g. yvzn/oenoteq}"
RG="${RG:-cellar-rg}"
APP_NAME="${APP_NAME:-cellar-github-deploy}"

SUB_ID="$(az account show --query id -o tsv)"
TENANT_ID="$(az account show --query tenantId -o tsv)"

CLIENT_ID="$(az ad app list --display-name "$APP_NAME" --query '[0].appId' -o tsv)"
if [ -z "$CLIENT_ID" ]; then
  CLIENT_ID="$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)"
  az ad sp create --id "$CLIENT_ID" -o none
fi

# Deploy job runs in GitHub environment "production": subject is environment-based.
if [ -z "$(az ad app federated-credential list --id "$CLIENT_ID" --query "[?name=='github-production'].name" -o tsv)" ]; then
  az ad app federated-credential create --id "$CLIENT_ID" --parameters "{
    \"name\": \"github-production\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"repo:$GITHUB_REPO:environment:production\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }" -o none
fi

# Least privilege: Contributor on the app's resource group only.
az role assignment create --assignee "$CLIENT_ID" --role Contributor \
  --scope "/subscriptions/$SUB_ID/resourceGroups/$RG" -o none

echo "Set these GitHub repo variables (Settings > Secrets and variables > Actions > Variables):"
echo "  AZURE_CLIENT_ID=$CLIENT_ID"
echo "  AZURE_TENANT_ID=$TENANT_ID"
echo "  AZURE_SUBSCRIPTION_ID=$SUB_ID"
echo "Also create a GitHub environment named: production"
