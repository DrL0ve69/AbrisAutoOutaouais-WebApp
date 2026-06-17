# Infrastructure backend (Terraform)

Provisionne le **backend AbrisTempo** sur Azure de façon déclarative et reproductible :
**Resource Group + Azure SQL S0 + Azure Container Registry + Azure Container Apps**.

> Le **frontend** reste sur **Azure Static Web Apps** (déjà déployé, piloté par
> `.github/workflows/azure-static-web-apps.yml`) — volontairement **hors** de cet état Terraform
> pour éviter un destroy/recreate accidentel. Les **déploiements continus** de l'image API passent
> par `.github/workflows/azure-container-app.yml` (build ACR Tasks + `az containerapp update`) ;
> Terraform ne fait que le **provisioning initial**.

C'est l'équivalent déclaratif de `docs/deployment.md` §4.2 (mapping `az` → Terraform :
`docs/infra-terraform.md` §4).

## Pré-requis

```powershell
winget install --id Microsoft.AzureCLI -e
winget install --id Hashicorp.Terraform -e
az login                          # choisir l'abonnement étudiant
az account show --query id -o tsv # → subscription_id
```

## Secrets — jamais dans le dépôt

Le mot de passe SQL et la clé JWT sont des variables **sensibles** sans défaut. Fournis-les via un
`terraform.tfvars` **gitignoré** (voir `terraform.tfvars.example`) ou des variables d'environnement
`TF_VAR_*`. L'`*.tfstate` contient ces valeurs en clair → il est **gitignoré** (ne jamais le pousser).

```powershell
Copy-Item terraform.tfvars.example terraform.tfvars
# éditer terraform.tfvars : subscription_id + mot de passe SQL fort + clé JWT ≥ 32 caractères
```

## Cycle

```powershell
terraform init     # télécharge le provider azurerm, écrit .terraform.lock.hcl (à COMMITER)
terraform fmt      # formate les .tf
terraform validate # vérifie la syntaxe / la cohérence
terraform plan     # LIRE le diff : Terraform annonce ce qu'il CRÉE / MODIFIE / DÉTRUIT
terraform apply    # taper « yes » — provisionne réellement
terraform output container_app_fqdn   # FQDN de l'API → à reporter dans environment.prod.ts
```

> **Toujours lire le `plan` avant `apply`.** Un renommage de ressource peut signifier
> *supprimer + recréer* (perte de données sur la base !).

## Après l'apply

1. Reporter le FQDN dans `src/AbrisAutoOutaouais-WebApp.Client/src/environments/environment.prod.ts`
   → `apiUrl: 'https://<FQDN>/api/v1'` (l'assistant le fait sur demande).
2. Configurer le **credential CD** (service principal + secret GitHub `AZURE_CREDENTIALS` + droit
   AcrPush) — voir `docs/deployment.md` §4.2 / le plan Épic H.
3. Pousser `master` → le workflow build l'image dans l'ACR et met à jour la Container App.

## Notes

- **Image d'amorçage.** Au 1er `apply`, la Container App tourne sur une image publique
  (`containerapps-helloworld`) car l'image ACR réelle n'existe pas encore. Le workflow CD la
  remplace ; `lifecycle.ignore_changes` sur l'image évite que Terraform la « réverte » ensuite.
- **AcrPull.** L'identité managée de l'app reçoit `AcrPull` (créé après l'app, donc absent au 1er
  pull — sans incidence, l'amorçage est public ; le pull ACR n'arrive qu'au déploiement CD).
- **Noms globalement uniques.** `sql_server_name` et `acr_name` doivent être uniques à l'échelle
  Azure. Si tu changes l'ACR, pose aussi `gh variable set AZURE_ACR_NAME <nom>` (le workflow le lit).
- **État distant (évolution équipe).** Pour du multi-personnes, remplacer l'état local par un backend
  verrouillé — ajouter dans `main.tf` :
  ```hcl
  terraform {
    backend "azurerm" {
      resource_group_name  = "tfstate-rg"
      storage_account_name = "abristempotfstate"
      container_name       = "tfstate"
      key                  = "backend.tfstate"
    }
  }
  ```
  (le compte de stockage doit exister au préalable) puis `terraform init -migrate-state`.
- **Détruire l'environnement** : `terraform destroy` (supprime **tout** le backend — pas le SWA).
