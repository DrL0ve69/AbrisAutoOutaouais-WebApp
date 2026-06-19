# ──────────────────────────────────────────────────────────────────────────────
# AbrisTempo Local — Infrastructure backend (Azure) en Terraform.
#
# Provisionne le BACKEND uniquement : Resource Group + Azure SQL S0 + Azure
# Container Registry + Azure Container Apps. Le frontend reste sur Azure Static
# Web Apps (déjà déployé, piloté par son propre workflow GitHub) → volontairement
# HORS de cet état Terraform pour éviter un destroy/recreate.
#
# Équivalent déclaratif de la séquence `az` de docs/deployment.md §4.2
# (mapping détaillé : docs/infra-terraform.md §4). Les déploiements CONTINUS de
# l'image passent ensuite par .github/workflows/azure-container-app.yml
# (build ACR Tasks + `az containerapp update`) — Terraform ne fait que le
# provisioning initial.
#
# Secrets (mot de passe SQL, clé JWT) : JAMAIS en clair ici → variables sensibles
# fournies via terraform.tfvars (gitignoré) ou TF_VAR_*. Voir infra/README.md.
# ──────────────────────────────────────────────────────────────────────────────

terraform {
  required_version = ">= 1.6"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
  # État LOCAL (gitignoré) — adapté à un projet solo. En équipe, passer à un
  # backend distant verrouillé (Azure Storage) — voir infra/README.md.
}

provider "azurerm" {
  features {}
  # azurerm v4 exige l'ID d'abonnement explicitement (ou via ARM_SUBSCRIPTION_ID).
  subscription_id = var.subscription_id
}

# Étiquettes communes à toutes les ressources (traçabilité / coûts).
locals {
  tags = {
    project     = "abristempo"
    environment = "production"
    managed_by  = "terraform"
  }

  # Chaîne de connexion SQL construite à partir des ressources créées.
  # Encrypt=True + TrustServerCertificate=False = transport TLS exigé (Azure SQL).
  connection_string = join("", [
    "Server=tcp:${azurerm_mssql_server.sql.fully_qualified_domain_name},1433;",
    "Database=${azurerm_mssql_database.db.name};",
    "User ID=${var.sql_admin_login};",
    "Password=${var.sql_admin_password};",
    "Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;",
  ])
}

# ── Resource Group ────────────────────────────────────────────────────────────
resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
  tags     = local.tags
}

# ── Azure SQL : serveur + base S0 (gratuite 12 mois) + pare-feu « services Azure »
resource "azurerm_mssql_server" "sql" {
  name                          = var.sql_server_name # GLOBALEMENT unique
  resource_group_name           = azurerm_resource_group.main.name
  location                      = azurerm_resource_group.main.location
  version                       = "12.0"
  administrator_login           = var.sql_admin_login
  administrator_login_password  = var.sql_admin_password
  minimum_tls_version           = "1.2"
  public_network_access_enabled = true
  tags                          = local.tags
}

resource "azurerm_mssql_database" "db" {
  name           = var.sql_database_name
  server_id      = azurerm_mssql_server.sql.id
  sku_name       = "S0"
  zone_redundant = false
  tags           = local.tags
}

# Règle 0.0.0.0–0.0.0.0 = « Autoriser les services et ressources Azure » (le
# Container App, hébergé sur Azure, peut joindre la base). Pas d'IP publique ouverte.
resource "azurerm_mssql_firewall_rule" "allow_azure" {
  name             = "AllowAzureServices"
  server_id        = azurerm_mssql_server.sql.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# ── Azure Container Registry ──────────────────────────────────────────────────
# admin_enabled = true : ACR Tasks étant DÉSACTIVÉ sur l'abonnement étudiant
# (TasksOperationsNotAllowed), `az acr build` est impossible — l'image est donc
# construite localement par le SDK .NET (`dotnet publish /t:PublishContainer`, sans
# Docker) qui POUSSE via les identifiants admin (basic-auth). Le compte admin ne
# sert QU'AU PUSH ; au RUNTIME, l'app TIRE toujours l'image via son identité managée
# user-assigned (AcrPull plus bas). Repasse à false si un jour ACR Tasks/Docker/SP
# deviennent disponibles.
resource "azurerm_container_registry" "acr" {
  name                = var.acr_name # 5–50 alphanum, GLOBALEMENT unique
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Basic"
  admin_enabled       = true
  tags                = local.tags
}

# ── Log Analytics : collecte des logs console/système du Container App ─────────
# Observabilité PROD. Sans ce workspace, l'environnement n'a AUCUN store de logs
# (destination vide) → un crash applicatif au démarrage est INVISIBLE (seul un
# « exit 139 » remonte). C'est ce workspace qui a permis de diagnostiquer le crash
# du ShelterModelSeeder (IReadOnlySet.Contains non traduisible par SQL Server —
# L-035/L-001). Free-tier PerGB2018, rétention 30 j.
resource "azurerm_log_analytics_workspace" "logs" {
  name                = var.log_analytics_workspace_name
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.tags
}

# ── Container Apps : environnement + application API ───────────────────────────
resource "azurerm_container_app_environment" "env" {
  name                       = var.container_app_environment_name
  resource_group_name        = azurerm_resource_group.main.name
  location                   = azurerm_resource_group.main.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.logs.id
  tags                       = local.tags
}

resource "azurerm_container_app" "api" {
  name                         = var.container_app_name
  container_app_environment_id = azurerm_container_app_environment.env.id
  resource_group_name          = azurerm_resource_group.main.name
  revision_mode                = "Single"
  tags                         = local.tags

  # Identité managée USER-ASSIGNED (créée AVANT l'app, AcrPull pré-attribué).
  # On N'UTILISE PAS l'identité system-assigned ici : créée en même temps que l'app,
  # le registre ne peut pas s'y câbler de façon fiable pendant le provisioning → la
  # révision « expire ». L'identité user-assigned existe en amont → câblage propre.
  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.api.id]
  }

  # Authentification au registre via l'identité managée (pas d'identifiants admin).
  registry {
    server   = azurerm_container_registry.acr.login_server
    identity = azurerm_user_assigned_identity.api.id
  }

  # Secrets de l'app (référencés par les variables d'environnement ci-dessous).
  secret {
    name  = "connstr"
    value = local.connection_string
  }
  secret {
    name  = "jwtkey"
    value = var.jwt_key
  }

  ingress {
    external_enabled = true
    target_port      = 8080 # le conteneur écoute en HTTP 8080 (Dockerfile) ; l'ingress termine le TLS
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = 0 # scale-to-zero (free grant)
    max_replicas = 1

    container {
      name = "api"

      # IMAGE D'AMORÇAGE (publique) : l'image ACR réelle n'existe pas encore au
      # 1er apply (poule/œuf). Le workflow CD la remplacera via `containerapp update`.
      # ignore_changes (lifecycle) empêche Terraform de la « réverter » ensuite.
      # DOIT écouter sur le `target_port` de l'ingress (8080), sinon la sonde de santé
      # échoue et la révision « expire ». L'exemple ASP.NET .NET 8+ écoute sur 8080
      # et tourne non-root — même contrat que notre Dockerfile.
      image  = "mcr.microsoft.com/dotnet/samples:aspnetapp"
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "ASPNETCORE_ENVIRONMENT"
        value = "Production"
      }
      # Anti-boucle 307 derrière l'ingress (TLS terminé, HTTP interne) — L-022.
      env {
        name  = "ASPNETCORE_FORWARDEDHEADERS_ENABLED"
        value = "true"
      }
      # Migration EF AU DÉMARRAGE, opt-in, PROD uniquement (dev/tests restent OFF) — L-022.
      env {
        name  = "Database__MigrateOnStartup"
        value = "true"
      }
      # CORS : origine du frontend SWA autorisée.
      env {
        name  = "AllowedOrigins"
        value = var.swa_url
      }
      env {
        name        = "ConnectionStrings__DefaultConnection"
        secret_name = "connstr"
      }
      env {
        name        = "Jwt__Key"
        secret_name = "jwtkey"
      }
    }
  }

  lifecycle {
    # Le pipeline CD pilote l'image en continu — ne pas la remettre à l'amorçage.
    ignore_changes = [template[0].container[0].image]
  }

  # AcrPull doit exister AVANT l'app pour que le pull ACR fonctionne au déploiement CD.
  depends_on = [azurerm_role_assignment.acr_pull]
}

# Identité managée user-assigned dédiée à l'app — créée AVANT l'app (casse le
# poule/œuf : le registre référence une identité qui possède déjà AcrPull).
resource "azurerm_user_assigned_identity" "api" {
  name                = "${var.container_app_name}-id"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  tags                = local.tags
}

# Droit pour l'identité managée de TIRER les images de l'ACR (déploiements CD).
resource "azurerm_role_assignment" "acr_pull" {
  scope                = azurerm_container_registry.acr.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.api.principal_id
}
