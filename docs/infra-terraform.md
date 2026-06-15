# Terraform & l'Infrastructure as Code (IaC)

> **Ce que c'est.** Une introduction à **Terraform** ancrée à l'infra réelle de ce projet. Aujourd'hui,
> `docs/deployment.md` provisionne Azure avec une **suite de commandes `az` impératives** (« fais ceci,
> puis cela »). Terraform fait la même chose en **déclaratif** (« voici l'état que je veux ») et
> **reproductible**. Ce doc montre le **mapping 1:1** entre nos commandes `az` et leur équivalent
> Terraform.
>
> **Et oui** — ta question : Terraform permet de déployer sur **plusieurs services/fournisseurs**
> (Azure, AWS, GCP, Cloudflare, GitHub…) avec **un seul outil et une seule syntaxe** (voir §5).

---

## 1. Le problème que ça résout

`docs/deployment.md` crée l'infra à la main :

```bash
az group create ...
az sql db create -g $RG -s $SQL -n $DB --service-objective S0
az acr create -n $ACR -g $RG --sku Basic
az containerapp create ...
```

Ça marche, mais :
- **Pas reproductible** — refaire un environnement (staging, démo) = rejouer les commandes à la main,
  et espérer le même résultat.
- **Pas d'état connu** — quel SKU sur la base, déjà ? Quelqu'un a-t-il changé un réglage au portail ?
  La vérité est « dans Azure », pas dans le dépôt.
- **Pas de revue** — un changement d'infra ne passe pas par une PR comme le code.
- **Suppression manuelle** — détruire proprement un environnement = se souvenir de tout.

**L'Infrastructure as Code (IaC)** met l'infra **dans des fichiers versionnés** : l'infra devient du
code — revue en PR, reproductible, détruisible d'une commande, diffable dans l'historique git.

---

## 2. Terraform en 4 idées

1. **Déclaratif.** Tu décris l'**état désiré** (« une base SQL S0 nommée X »). Terraform calcule les
   actions pour y arriver — tu ne scriptes pas les étapes.
2. **Le fichier d'état (`terraform.tfstate`).** Terraform mémorise ce qu'il a créé pour comparer
   *désiré* vs *réel* et n'appliquer que le **diff**. (En équipe, on le stocke à distance — voir §6.)
3. **Le cycle `plan` → `apply`.** `plan` montre ce qui *changerait* (créé/modifié/détruit) **avant**
   d'agir ; `apply` exécute. `destroy` supprime tout l'environnement.
4. **Les providers.** Des plugins qui parlent aux API des fournisseurs (`azurerm` pour Azure, `aws`,
   `google`, `cloudflare`, `github`…). Un même langage (HCL) pilote n'importe quel provider.

```
   écrire .tf  ──►  terraform plan  ──►  (revue du diff)  ──►  terraform apply  ──►  infra réelle
        ▲                                                            │
        └───────────────── terraform.tfstate (mémoire) ◄────────────┘
```

---

## 3. Anatomie d'un fichier (HCL)

```hcl
# Quel provider, quelle version — épinglée pour la reproductibilité
terraform {
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 4.0" }
  }
}
provider "azurerm" {
  features {}
}

# Une VARIABLE = une entrée paramétrable (réutiliser la conf pour dev/staging/prod)
variable "environment" {
  type    = string
  default = "prod"
}

# Une RESOURCE = un objet d'infra à créer ("type" "nom_local")
resource "azurerm_resource_group" "main" {
  name     = "abristempo-${var.environment}-rg"
  location = "canadacentral"
}

# Un OUTPUT = une valeur exposée après apply (URL, nom généré…)
output "resource_group" {
  value = azurerm_resource_group.main.name
}
```

Trois blocs à connaître : **`variable`** (entrées), **`resource`** (ce qu'on crée), **`output`**
(ce qu'on récupère). Les ressources se **référencent** entre elles
(`azurerm_resource_group.main.name`) — c'est ainsi que Terraform **déduit l'ordre** de création (le
groupe avant la base qui est dedans), sans qu'on l'écrive.

---

## 4. Notre infra `az` → son équivalent Terraform

Voici les commandes de `docs/deployment.md` §4.2 traduites. Ce fichier irait dans `infra/main.tf`
(non créé pour l'instant — l'infra réelle reste pilotée par `az` + GitHub Actions).

```hcl
# az group create
resource "azurerm_resource_group" "main" {
  name     = "abristempo-rg"
  location = "canadacentral"
}

# az sql ... + az sql db create --service-objective S0
resource "azurerm_mssql_server" "sql" {
  name                         = "abristempo-sql"
  resource_group_name          = azurerm_resource_group.main.name
  location                     = azurerm_resource_group.main.location
  version                      = "12.0"
  administrator_login          = var.sql_admin_login
  administrator_login_password = var.sql_admin_password   # via variable, JAMAIS en clair (voir §6)
}
resource "azurerm_mssql_database" "db" {
  name      = "AbrisTempoDb"
  server_id = azurerm_mssql_server.sql.id
  sku_name  = "S0"
}

# az acr create --sku Basic
resource "azurerm_container_registry" "acr" {
  name                = "abristempoacr"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Basic"
}

# az containerapp env create + az containerapp create
resource "azurerm_container_app_environment" "env" {
  name                = "abristempo-env"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
}
resource "azurerm_container_app" "api" {
  name                         = "abristempo-api"
  container_app_environment_id = azurerm_container_app_environment.env.id
  resource_group_name          = azurerm_resource_group.main.name
  revision_mode                = "Single"

  template {
    container {
      name   = "api"
      image  = "${azurerm_container_registry.acr.login_server}/abristempo-api:latest"
      cpu    = 0.5
      memory = "1Gi"
      # Le flag forwarded-headers de la leçon L-022 (évite la boucle 307 derrière l'ingress) :
      env { name = "ASPNETCORE_FORWARDEDHEADERS_ENABLED", value = "true" }
      # Migration EF au démarrage, opt-in (L-022) — activée seulement en prod :
      env { name = "Database__MigrateOnStartup", value = "true" }
    }
  }
}

# az staticwebapp create (plan Free)
resource "azurerm_static_web_app" "front" {
  name                = "abristempo-web"
  resource_group_name = azurerm_resource_group.main.name
  location            = "eastus2"   # SWA : régions limitées
  sku_tier            = "Free"
  sku_size            = "Free"
}
```

Le bénéfice saute aux yeux : ce **seul fichier**, versionné, *est* la définition de tout
l'environnement. `terraform plan` montre le diff avant d'agir ; `terraform apply` le crée ;
`terraform destroy` le supprime entièrement. Recréer un environnement « staging » = changer
`var.environment` et `apply`.

---

## 5. « Déployer sur plusieurs services » — oui, c'est le point fort

Ta question était juste : Terraform est **multi-fournisseurs**. Un même fichier peut piloter
**plusieurs providers à la fois**, et passer ou cumuler les clouds **sans changer d'outil ni de
langage** :

```hcl
provider "azurerm" { features {} }     # l'app + la base sur Azure
provider "cloudflare" {}               # le DNS sur Cloudflare
provider "github" {}                   # les secrets du repo GitHub (CI/CD)

resource "azurerm_container_app" "api"        { /* … */ }
resource "cloudflare_record"     "api_dns"    { /* pointe le domaine vers l'app Azure */ }
resource "github_actions_secret" "azure_creds"{ /* injecte les creds pour le déploiement */ }
```

Concrètement, Terraform sert à :
- **Multi-cloud / multi-service** : Azure + AWS + Cloudflare + GitHub décrits ensemble, déployés d'un
  `apply`, avec les dépendances entre eux résolues automatiquement.
- **Multi-environnement** : le **même** code paramétré par variables/*workspaces* produit dev,
  staging, prod identiques (fini le « ça marchait en dev »).
- **Éviter le verrouillage outil** : un seul langage (HCL) plutôt qu'un outil propriétaire par cloud
  (ARM/Bicep côté Azure, CloudFormation côté AWS…).

> Nuance honnête : Terraform unifie la **syntaxe et le flux**, pas les **concepts**. Une ressource
> `aws_*` reste différente d'une `azurerm_*` (les clouds ne sont pas interchangeables). Terraform te
> donne **un outil pour tous**, pas une infra « portable » magique.

---

## 6. Bonnes pratiques (et pièges)

- **État distant + verrou.** En équipe, ne garde pas `terraform.tfstate` en local : stocke-le dans un
  *backend* distant (Azure Storage, S3) avec verrouillage, sinon deux `apply` concurrents corrompent
  l'état.
- **Jamais de secret en clair.** `sql_admin_password` passe par une variable sensible (`TF_VAR_…`,
  Key Vault, secret CI) — **pas** dans le `.tf` versionné. Même discipline que `Jwt:Key` (voir
  `CLAUDE.md`).
- **Versions épinglées.** `version = "~> 4.0"` sur les providers → des `apply` reproductibles.
- **`plan` avant `apply`, toujours.** Lis le diff : Terraform annonce ce qu'il **détruit** — un
  renommage de ressource peut signifier *supprimer + recréer* (perte de données sur une base !).
- **Workflow type :** `terraform init` (télécharge les providers) → `fmt`/`validate` → `plan` (en PR,
  posté en commentaire) → `apply` (sur merge, via CI).

---

## 7. À retenir

- **IaC** = l'infra dans des fichiers versionnés : reproductible, revue en PR, détruisible d'une
  commande.
- **Terraform** = IaC **déclaratif** et **multi-fournisseurs** : tu décris l'état désiré, `plan`
  montre le diff, `apply` l'applique.
- Pour **ce projet**, Terraform remplacerait avantageusement le script `az` impératif de
  `docs/deployment.md` (un `infra/main.tf` versionné) — c'est l'évolution naturelle quand on veut
  des environnements reproductibles. Ce n'est **pas** encore en place : l'infra réelle est
  provisionnée par `az` + GitHub Actions.
- **Oui**, un même fichier Terraform déploie sur plusieurs services/clouds — c'est son intérêt
  central, à condition de gérer l'état distant et les secrets proprement.

*Repères : registry.terraform.io (provider `azurerm`), developer.hashicorp.com/terraform.
Alternatives à connaître : **Bicep/ARM** (IaC Azure-only, natif), **Pulumi** (IaC en vrai langage —
C#/TS), **AWS CloudFormation** (AWS-only). Pour le déploiement actuel de cette app, voir
`docs/deployment.md`.*
