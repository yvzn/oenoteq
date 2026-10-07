// Cellar on Azure Container Apps (ADR 0008). Deployed by infra/deploy.sh.
targetScope = 'resourceGroup'

param location string = resourceGroup().location
param namePrefix string = 'cellar'

@description('GHCR image, e.g. ghcr.io/yvzn/oenoteq:latest. Public image: no pull credentials.')
param image string

@description('Entra app registration (client) id, audience personal Microsoft accounts only.')
param clientId string

@secure()
param clientSecret string

@description('Entra object ids allowed to sign in. Empty = no restriction (any personal account!).')
param allowedIdentities array = []

@description('Paths reachable without login (PWA needs them, ticket 06).')
param excludedPaths array = [
  '/manifest.webmanifest'
  '/sw.js'
]

var storageName = toLower('${namePrefix}${uniqueString(resourceGroup().id)}')
var backupContainer = 'backups'

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
  }

  resource blob 'blobServices' = {
    name: 'default'
    resource container 'containers' = {
      name: backupContainer
    }
  }

  // Backstop for Litestream's own 7 day retention (docs/backup-and-restore.md).
  resource lifecycle 'managementPolicies' = {
    name: 'default'
    properties: {
      policy: {
        rules: [
          {
            name: 'expire-old-backups'
            enabled: true
            type: 'Lifecycle'
            definition: {
              filters: { blobTypes: [ 'blockBlob' ], prefixMatch: [ '${backupContainer}/' ] }
              actions: { baseBlob: { delete: { daysAfterModificationGreaterThan: 30 } } }
            }
          }
        ]
      }
    }
  }
}

// No logAnalyticsConfiguration: avoids Log Analytics ingestion cost. Use `az containerapp logs show`.
resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${namePrefix}-env'
  location: location
  properties: {}
}

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${namePrefix}-app'
  location: location
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
        allowInsecure: false
      }
      secrets: [
        { name: 'storage-key', value: storage.listKeys().keys[0].value }
        { name: 'auth-client-secret', value: clientSecret }
      ]
    }
    template: {
      containers: [
        {
          name: 'cellar'
          image: image
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
          env: [
            { name: 'LITESTREAM_AZURE_ACCOUNT_NAME', value: storage.name }
            { name: 'LITESTREAM_AZURE_ACCOUNT_KEY', secretRef: 'storage-key' }
            { name: 'LITESTREAM_AZURE_CONTAINER', value: backupContainer }
          ]
        }
      ]
      // At most one writer: SQLite on local disk. Min 0 = scale to zero, Litestream restores on
      // cold start (ADR 0008). Raise minReplicas to 1 if cold start becomes noticeable.
      scale: { minReplicas: 0, maxReplicas: 1 }
    }
  }
}

resource auth 'Microsoft.App/containerApps/authConfigs@2024-03-01' = {
  parent: app
  name: 'current'
  properties: {
    platform: { enabled: true }
    globalValidation: {
      unauthenticatedClientAction: 'RedirectToLoginPage'
      redirectToProvider: 'azureactivedirectory'
      excludedPaths: excludedPaths
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          // "consumers" tenant = personal Microsoft accounts.
          openIdIssuer: 'https://login.microsoftonline.com/consumers/v2.0'
          clientId: clientId
          clientSecretSettingName: 'auth-client-secret'
        }
        validation: {
          allowedAudiences: [ clientId ]
          defaultAuthorizationPolicy: empty(allowedIdentities) ? {} : {
            allowedPrincipals: { identities: allowedIdentities }
          }
        }
      }
    }
    login: { preserveUrlFragmentsForLogins: false }
  }
}

output fqdn string = app.properties.configuration.ingress.fqdn
output storageAccount string = storage.name
