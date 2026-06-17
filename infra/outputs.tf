# Valeurs exposées après `terraform apply`.

output "container_app_fqdn" {
  description = "FQDN public de l'API. À reporter dans environment.prod.ts → apiUrl: https://<FQDN>/api/v1"
  value       = azurerm_container_app.api.ingress[0].fqdn
}

output "container_app_url" {
  description = "URL HTTPS complète de l'API (base /api/v1)."
  value       = "https://${azurerm_container_app.api.ingress[0].fqdn}/api/v1"
}

output "acr_login_server" {
  description = "Serveur de connexion ACR (ex. abristempoacr.azurecr.io) — utilisé par le workflow CD."
  value       = azurerm_container_registry.acr.login_server
}

output "sql_server_fqdn" {
  description = "FQDN du serveur Azure SQL."
  value       = azurerm_mssql_server.sql.fully_qualified_domain_name
}
