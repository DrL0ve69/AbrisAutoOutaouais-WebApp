# Redéploiement du backend AbrisTempo — build + push + mise à jour de la Container App.
#
# POURQUOI ce script (et pas `az acr build`) : sur l'abonnement étudiant, ACR Tasks
# est DÉSACTIVÉ (TasksOperationsNotAllowed) → impossible de construire l'image côté
# Azure, et aucun Docker local. On construit donc l'image avec le SDK .NET
# (`dotnet publish /t:PublishContainer`, sans Docker) et on pousse vers ACR avec les
# identifiants admin (basic-auth). Au RUNTIME, la Container App TIRE l'image via son
# identité managée user-assigned (AcrPull) — la sécurité d'exécution ne change pas.
#
# Pré-requis : `az login` fait, az CLI + .NET SDK 10 sur le PATH. Lance depuis n'importe où.
#   pwsh infra/deploy-backend.ps1
#
# Idempotent : chaque exécution pousse un tag horodaté unique → nouvelle révision propre.

param(
  [string]$ResourceGroup = "abristempo-rg",
  [string]$Acr           = "abristempoacr",
  [string]$App           = "abristempo-api",
  [string]$Repository    = "abristempo-api"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ApiCsproj = Join-Path $ScriptDir "..\src\AbrisAutoOutaouais-WebApp.API\AbrisAutoOutaouais-WebApp.API.csproj"
$LoginServer = "$Acr.azurecr.io"
$Tag = Get-Date -Format "yyyyMMddHHmmss"   # tag unique → force une nouvelle révision

Write-Host "==> Identifiants ACR (admin) → docker config" -ForegroundColor Cyan
$u = az acr credential show -n $Acr --query username -o tsv
$p = az acr credential show -n $Acr --query "passwords[0].value" -o tsv
if (-not $p) { throw "Impossible de récupérer les identifiants ACR (admin activé ?)." }
$authValue = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${u}:${p}"))
$dockerDir = Join-Path $env:USERPROFILE ".docker"
New-Item -ItemType Directory -Force -Path $dockerDir | Out-Null
$config = @{ auths = @{ $LoginServer = @{ auth = $authValue } } } | ConvertTo-Json -Depth 5
Set-Content -Path (Join-Path $dockerDir "config.json") -Value $config -Encoding ascii

Write-Host "==> Build + push de l'image $Repository`:$Tag (SDK .NET, sans Docker)" -ForegroundColor Cyan
dotnet publish $ApiCsproj -c Release --os linux --arch x64 /t:PublishContainer `
  -p:ContainerRegistry=$LoginServer `
  -p:ContainerRepository=$Repository `
  -p:ContainerImageTag=$Tag
if ($LASTEXITCODE -ne 0) { throw "dotnet publish a échoué." }

Write-Host "==> Mise à jour de la Container App sur $LoginServer/$Repository`:$Tag" -ForegroundColor Cyan
az containerapp update -n $App -g $ResourceGroup --image "$LoginServer/$Repository`:$Tag" -o none
if ($LASTEXITCODE -ne 0) { throw "az containerapp update a échoué." }

$fqdn = az containerapp show -n $App -g $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv
Write-Host "`n✅ Déployé. API : https://$fqdn/api/v1  (tag $Tag)" -ForegroundColor Green
