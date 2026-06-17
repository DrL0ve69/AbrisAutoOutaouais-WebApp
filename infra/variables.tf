# Variables d'entrée du module infra/.
#
# Les NOMS par défaut s'alignent sur les défauts du workflow CD
# (.github/workflows/azure-container-app.yml) : RG, ACR et app y sont
# `abristempo-rg` / `abristempoacr` / `abristempo-api`. Si tu changes l'ACR ici,
# pose aussi `gh variable set AZURE_ACR_NAME <nom>` (idem RG / app si modifiés).

variable "subscription_id" {
  type        = string
  description = "ID de l'abonnement Azure (azurerm v4 l'exige). `az account show --query id -o tsv`."
}

variable "location" {
  type        = string
  description = "Région Azure. canadacentral pour un commerce de l'Outaouais."
  default     = "canadacentral"
}

variable "resource_group_name" {
  type        = string
  description = "Nom du Resource Group (= défaut du workflow CD)."
  default     = "abristempo-rg"
}

# ── SQL ───────────────────────────────────────────────────────────────────────
variable "sql_server_name" {
  type        = string
  description = "Nom du serveur Azure SQL — doit être GLOBALEMENT unique (DNS public)."
  default     = "abristempo-sql"
}

variable "sql_database_name" {
  type        = string
  description = "Nom de la base."
  default     = "AbrisTempoDb"
}

variable "sql_admin_login" {
  type        = string
  description = "Identifiant administrateur SQL."
  default     = "sqladmin"
}

variable "sql_admin_password" {
  type        = string
  description = "Mot de passe administrateur SQL (FORT). JAMAIS commité — via tfvars (gitignoré) ou TF_VAR_sql_admin_password."
  sensitive   = true
}

# ── Container Registry / Container App ─────────────────────────────────────────
variable "acr_name" {
  type        = string
  description = "Nom de l'Azure Container Registry — 5–50 alphanum, GLOBALEMENT unique (= défaut du workflow CD)."
  default     = "abristempoacr"
}

variable "container_app_environment_name" {
  type        = string
  description = "Nom de l'environnement Container Apps."
  default     = "abristempo-cae"
}

variable "container_app_name" {
  type        = string
  description = "Nom de la Container App API (= défaut du workflow CD)."
  default     = "abristempo-api"
}

# ── Application ────────────────────────────────────────────────────────────────
variable "jwt_key" {
  type        = string
  description = "Clé de signature JWT (≥ 32 caractères). JAMAIS commitée — via tfvars (gitignoré) ou TF_VAR_jwt_key."
  sensitive   = true

  validation {
    condition     = length(var.jwt_key) >= 32
    error_message = "La clé JWT doit faire au moins 32 caractères."
  }
}

variable "swa_url" {
  type        = string
  description = "URL du frontend Static Web Apps (CORS / AllowedOrigins). Doit matcher ton domaine SWA réel."
  default     = "https://kind-water-0efca2b10.7.azurestaticapps.net"
}
