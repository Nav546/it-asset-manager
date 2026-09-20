// ============================================================================
// IT Asset & Incident Management System - Azure Container Apps deployment
// Deploys: ACR, Log Analytics, Container Apps Environment, Storage (for
// Postgres persistence), and 4 Container Apps (database, redis, backend, frontend)
// ============================================================================

@description('Location for all resources')
param location string = resourceGroup().location

@description('Base name used to derive resource names (must be globally unique for ACR/Storage)')
param baseName string = 'itam${uniqueString(resourceGroup().id)}'

@description('Postgres admin username')
param dbUser string = 'itam_admin'

@secure()
@description('Postgres admin password')
param dbPassword string

@description('Postgres database name')
param dbName string = 'itam_db'

@secure()
@description('JWT signing secret for the backend API')
param jwtSecret string

@description('Container image tag to deploy (set by CI/CD pipeline)')
param imageTag string = 'latest'

var acrName = '${baseName}acr'
var logAnalyticsName = '${baseName}-logs'
var envName = '${baseName}-env'
var storageAccountName = '${baseName}sa'
var fileShareName = 'postgres-data'

// ----------------------------------------------------------------------------
// Azure Container Registry - hosts backend & frontend images
// ----------------------------------------------------------------------------
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
  }
}

// ----------------------------------------------------------------------------
// Log Analytics - required backing store for the Container Apps Environment
// ----------------------------------------------------------------------------
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// ----------------------------------------------------------------------------
// Storage Account + File Share - persistent volume for Postgres data
// ----------------------------------------------------------------------------
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    minimumTlsVersion: 'TLS1_2'
  }
}

resource fileService 'Microsoft.Storage/storageAccounts/fileServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
}

resource fileShare 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-01-01' = {
  parent: fileService
  name: fileShareName
  properties: {
    shareQuota: 5
  }
}

// ----------------------------------------------------------------------------
// Container Apps Environment
// ----------------------------------------------------------------------------
resource containerAppEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: envName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// Link the Azure Files share to the environment so containers can mount it
resource envStorage 'Microsoft.App/managedEnvironments/storages@2024-03-01' = {
  parent: containerAppEnv
  name: 'postgres-storage'
  properties: {
    azureFile: {
      accountName: storageAccount.name
      accountKey: storageAccount.listKeys().keys[0].value
      shareName: fileShareName
      accessMode: 'ReadWrite'
    }
  }
}

// ----------------------------------------------------------------------------
// Database (Postgres) - internal only, TCP ingress, persistent volume
// ----------------------------------------------------------------------------
resource databaseApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'database'
  location: location
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      ingress: {
        external: false
        targetPort: 5432
        transport: 'tcp'
      }
      secrets: [
        {
          name: 'db-password'
          value: dbPassword
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'database'
          image: 'postgres:16-alpine'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'POSTGRES_USER', value: dbUser }
            { name: 'POSTGRES_PASSWORD', secretRef: 'db-password' }
            { name: 'POSTGRES_DB', value: dbName }
          ]
                }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
}

// ----------------------------------------------------------------------------
// Redis - internal only, TCP ingress
// ----------------------------------------------------------------------------
resource redisApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'redis'
  location: location
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      ingress: {
        external: false
        targetPort: 6379
        transport: 'tcp'
      }
    }
    template: {
      containers: [
        {
          name: 'redis'
          image: 'redis:7-alpine'
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
}

// ----------------------------------------------------------------------------
// Backend API - internal only, HTTP ingress, scales to zero when idle
// ----------------------------------------------------------------------------
resource backendApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'backend'
  location: location
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      ingress: {
        external: false
        targetPort: 5000
        transport: 'http'
      }
      registries: [
        {
          server: acr.properties.loginServer
          username: acr.listCredentials().username
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        {
          name: 'acr-password'
          value: acr.listCredentials().passwords[0].value
        }
        {
          name: 'db-password'
          value: dbPassword
        }
        {
          name: 'jwt-secret'
          value: jwtSecret
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'backend'
          image: '${acr.properties.loginServer}/it-asset-manager-backend:${imageTag}'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'DB_HOST', value: 'database' }
            { name: 'DB_PORT', value: '5432' }
            { name: 'DB_USER', value: dbUser }
            { name: 'DB_PASSWORD', secretRef: 'db-password' }
            { name: 'DB_NAME', value: dbName }
            { name: 'REDIS_HOST', value: 'redis' }
            { name: 'REDIS_PORT', value: '6379' }
            { name: 'JWT_SECRET', secretRef: 'jwt-secret' }
            { name: 'PORT', value: '5000' }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 2
      }
    }
  }
  dependsOn: [
    databaseApp
    redisApp
  ]
}

// ----------------------------------------------------------------------------
// Frontend - the only externally exposed service
// ----------------------------------------------------------------------------
resource frontendApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'frontend'
  location: location
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 80
        transport: 'http'
      }
      registries: [
        {
          server: acr.properties.loginServer
          username: acr.listCredentials().username
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        {
          name: 'acr-password'
          value: acr.listCredentials().passwords[0].value
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'frontend'
          image: '${acr.properties.loginServer}/it-asset-manager-frontend:${imageTag}'
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 2
      }
    }
  }
  dependsOn: [
    backendApp
  ]
}

output acrLoginServer string = acr.properties.loginServer
output frontendUrl string = 'https://${frontendApp.properties.configuration.ingress.fqdn}'