#!/bin/sh
# One-time: let GitHub Actions deploy to Azure via OIDC federated credentials (no stored secret).
# Needs: az CLI logged in as an owner of the subscription, and gh CLI logged in.
#
#   GITHUB_REPO=<owner>/<repo> sh infra/setup-github-oidc.sh
#
# Prints the three values to store as GitHub repo variables (not secrets).
set -eu

GITHUB_REPO="${GITHUB_REPO:?set GITHUB_REPO, e.g. <owner>/<repo>}"
RG="${RG:-cellar-rg}"
APP_NAME="${APP_NAME:-cellar-github-deploy}"

SUB_ID="$(az account show --query id -o tsv)"
TENANT_ID="$(az account show --query tenantId -o tsv)"

CLIENT_ID="$(az ad app list --display-name "$APP_NAME" --query '[0].appId' -o tsv)"
if [ -z "$CLIENT_ID" ]; then
  CLIENT_ID="$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)"
  az ad sp create --id "$CLIENT_ID" -o none
fi

# GitHub OIDC subjects include owner and repo IDs (repo:<owner>@<ownerId>/<repo>@<repoId>),
# so fetch them from the GitHub API.
OWNER_LOGIN="$(gh api "repos/$GITHUB_REPO" --jq .owner.login)"
OWNER_ID="$(gh api "repos/$GITHUB_REPO" --jq .owner.id)"
REPO_ID="$(gh api "repos/$GITHUB_REPO" --jq .id)"
REPO_NAME="${GITHUB_REPO#*/}"

# Deploy job runs in GitHub environment "production": subject is environment-based.
SUBJECT="repo:$OWNER_LOGIN@$OWNER_ID/$REPO_NAME@$REPO_ID:environment:production"
# Written to a file: Git Bash on Windows mangles inline JSON passed to az.
CRED_FILE="$(mktemp)"
trap 'rm -f "$CRED_FILE"' EXIT
cat > "$CRED_FILE" <<EOF
{
  "name": "github-production",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "$SUBJECT",
  "audiences": ["api://AzureADTokenExchange"]
}
EOF

if [ -z "$(az ad app federated-credential list --id "$CLIENT_ID" --query "[?name=='github-production'].name" -o tsv)" ]; then
  az ad app federated-credential create --id "$CLIENT_ID" --parameters "$CRED_FILE" -o none
else
  az ad app federated-credential update --id "$CLIENT_ID" --federated-credential-id github-production --parameters "$CRED_FILE" -o none
fi

# Least privilege: Contributor on the app's resource group only.
az role assignment create --assignee "$CLIENT_ID" --role Contributor \
  --scope "/subscriptions/$SUB_ID/resourceGroups/$RG" -o none

echo "Set these GitHub repo variables (Settings > Secrets and variables > Actions > Variables):"
echo "  AZURE_CLIENT_ID=$CLIENT_ID"
echo "  AZURE_TENANT_ID=$TENANT_ID"
echo "  AZURE_SUBSCRIPTION_ID=$SUB_ID"
echo "Also create a GitHub environment named: production"
