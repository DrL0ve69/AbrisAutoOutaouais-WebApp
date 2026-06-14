# Déploiement & environnements

Trois environnements : **dev** (local), **staging** (pré-production), **production**.

## 1. Configuration par environnement

### Backend (.NET) — `ASPNETCORE_ENVIRONMENT`
ASP.NET Core charge `appsettings.json` **puis** `appsettings.{ASPNETCORE_ENVIRONMENT}.json` (qui surcharge).

| Environnement | `ASPNETCORE_ENVIRONMENT` | Fichier |
|---|---|---|
| Dev | `Development` | `appsettings.Development.json` |
| Staging | `Staging` | `appsettings.Staging.json` |
| Production | `Production` | `appsettings.Production.json` |

> Les fichiers `appsettings*.json` sont copiés automatiquement à la publication (SDK Web).

### Frontend (Angular) — configurations de build
Chaque build remplace `environment.ts` par le fichier de l'environnement (via `fileReplacements` dans `angular.json`) :

| Build | Commande | Fichier d'environnement |
|---|---|---|
| Dev | `npm start` / `npm run build` | `environments/environment.ts` |
| Staging | `ng build --configuration staging` | `environments/environment.staging.ts` |
| Production | `npm run build:prod` | `environments/environment.prod.ts` |

## 2. Secrets — JAMAIS dans le dépôt

Les valeurs sensibles **ne sont pas commitées**. En staging/production, elles proviennent de la
**configuration Azure App Service** (ou **Key Vault**) sous forme de variables d'environnement :

| Variable d'environnement | Remplace la clé de config |
|---|---|
| `ConnectionStrings__DefaultConnection` | chaîne de connexion SQL |
| `Jwt__Key` | clé de signature JWT (≥ 32 caractères) |
| `Jwt__Issuer`, `Jwt__Audience` | émetteur / audience |
| `AllowedOrigins` | origines CORS autorisées |

En local, garder ces valeurs dans `appsettings.Development.json` ou `dotnet user-secrets`.

## 3. CI/CD

- **CI** (build + tests + accessibilité axe) : déjà assurée par **GitHub Actions**
  (`.github/workflows/ci.yml`), exécutée à chaque push et PR.
- **CD** (déploiement progressif) : `azure-pipelines.yml` — `Build → Dev → Staging → Production`.

### Mise en place dans Azure DevOps
1. **Service connection** : *Project settings → Service connections → New → Azure Resource Manager*
   (sélectionner l'abonnement). Reporter son nom dans la variable `azureSubscription` du pipeline.
2. **App Services** : créer un App Service par environnement (Linux, .NET 10) et reporter les noms
   dans `apiAppNameDev/Staging/Prod`. Y définir `ASPNETCORE_ENVIRONMENT` + les secrets ci-dessus
   (idéalement via *Key Vault references*).
3. **Environments + approbations** : *Pipelines → Environments → New* pour `staging` et `production`,
   puis ajouter une **Approval check** (déploiement manuel validé par un approbateur).
4. **Pipeline** : *Pipelines → New → GitHub → ce dépôt → Existing YAML → `/azure-pipelines.yml`*.

## 4. Hébergement du frontend (i18n compile-time, fr + en)

L'i18n est **compile-time** (`@angular/localize`) : `npm run build:prod` produit **une
application par langue** sous `dist/abristempo-client/browser/` — le français (locale source)
à la racine (baseHref `/`) et l'anglais sous `en/` (baseHref `/en/`), via `subPath`
(cf. `angular.json` → `i18n`). Les **deux** doivent être servies ensemble derrière une seule
origine ; `ng serve` n'en sert qu'une à la fois (utile seulement en dev).

**Hôte bilingue fourni — `scripts/serve-i18n.mjs`** (copié à la racine de l'artifact par le
postbuild de `build:prod`). Il sert le français à `/`, l'anglais à `/en/`, avec repli SPA par
locale et cache long sur les ressources hachées. Le sélecteur de langue de la navbar (et la
« langue préférée » du profil) basculent en rechargeant l'autre baseHref en conservant le chemin.

> **Équivalent dev — `npm run dev:i18n`.** Reproduit ce démarrage prod bilingue en local
> (= `npm run build:i18n && node scripts/serve-i18n.mjs`, fr à `/`, en à `/en/`, port 4300). C'est
> la SEULE façon d'exercer la bascule de langue hors prod : `npm start` (`ng serve`) ne sert que le
> français (`environment.localized = false`), où le bouton « EN » est volontairement dégradé
> (focusable mais annoncé indisponible). En prod/staging le build est localisé
> (`environment.localized = true`) et le bouton est pleinement actif.

- **Azure Static Web Apps (gratuit, recommandé)** — hébergement **statique** : SWA ne lance pas
  `serve-i18n.mjs`, mais reproduit le même repli SPA par locale via
  **`public/staticwebapp.config.json`** (copié à la racine du build). Déploiement par **GitHub
  Actions** (`.github/workflows/azure-static-web-apps.yml`). Voir la mise en place ci-dessous.
- **Azure App Service (Node)** — alternative *server* : déployer l'artifact `client`
  (= `dist/abristempo-client`), **commande de démarrage** `node serve-i18n.mjs` (`PORT` fourni par
  App Service). Vérifiable en local : `npm run build:i18n && npm run preview:i18n`.

> *Suivi possible (SEO) :* rendu **SSR par locale** — les bundles `server/server.mjs` (fr) et
> `server/en/server.mjs` (en) existent, mais composer les deux derrière une origine unique
> (montage par baseHref) reste à faire et à vérifier ; l'hôte statique ci-dessus est la solution
> livrée et testée.

### 4.1 Mise en place Azure Static Web Apps (plan **Free**, 0 $)

Le **plan Free** de SWA est gratuit (SSL, domaines, 100 Go/mois, **environnements de
prévisualisation par PR**). Un compte **Azure for Students** convient ; le plan Free ne consomme
pas de crédit (service « toujours gratuit »). **Pas besoin d'Azure DevOps** : GitHub Actions +
les preview environments de SWA couvrent prod (branche `master`) et « staging » (chaque PR).

1. **Créer la ressource** (Portail Azure → *Create a resource → Static Web App*) :
   - *Plan type* : **Free**.
   - *Deployment source* : **Other** (le workflow GitHub est déjà fourni — ne pas laisser SWA en
     créer un second). Région au choix.
   - Alternative CLI : `az staticwebapp create -n abristempo-web -g <rg> --sku Free`.
2. **Récupérer le jeton de déploiement** : SWA → *Manage deployment token* (ou
   `az staticwebapp secrets list -n abristempo-web --query "properties.apiKey" -o tsv`).
3. **Ajouter le secret GitHub** : repo → *Settings → Secrets and variables → Actions → New
   repository secret* → nom **`AZURE_STATIC_WEB_APPS_API_TOKEN`**, valeur = le jeton.
4. **Déclencher** : pousser sur `master` (ou rouvrir le workflow). Tant que le secret est absent,
   l'étape de déploiement se **saute** (workflow vert, build seul). Une fois le secret en place :
   - `master` → **production** `https://<nom>.azurestaticapps.net`
   - chaque **PR** → URL de **prévisualisation** éphémère (commentée sur la PR), fermée à la
     fusion par le job `close_pull_request`.
5. **Vérifier** : ouvrir `/` (fr, bouton « EN ») puis `/en/` (en, bouton « Switch to French ») ;
   un lien profond comme `/en/boutique` doit charger l'app **anglaise** (repli géré par
   `staticwebapp.config.json`, validé via l'émulateur `swa start`).

### 4.2 Backend (.NET 10) — Azure Container Apps + Azure SQL (plan étudiant, 0 $)

L'API se déploie en **conteneur** sur **Azure Container Apps** (free grant : 180 000 vCPU-s +
360 000 GiB-s + 2 M requêtes/mois, **scale-to-zero**) ; la base sur **Azure SQL Database S0**
(gratuit 12 mois — provider EF Core `SqlServer` **inchangé**, aucune migration à régénérer).
L'image est construite par **ACR Tasks** (pas de Docker local). CD : workflow
`.github/workflows/azure-container-app.yml`, **inerte** tant que le secret `AZURE_CREDENTIALS`
est absent (comme le SWA).

Artefacts déjà prêts dans le dépôt : **`Dockerfile`** (multi-étapes, contexte = racine),
**`.dockerignore`**, **migration EF opt-in au démarrage** (`Database__MigrateOnStartup=true` → le
conteneur migre la base **avant** les seeders, sans étape de migration séparée), **CORS prod**
(`appsettings.Production.json`) pointant déjà sur l'URL SWA.

#### Provisioning (une fois) — `az` CLI (PowerShell)
```powershell
# 0. Variables — adapte région/noms ; les noms doivent matcher les `vars` du workflow.
$RG="abristempo-rg"; $LOC="canadacentral"
$ACR="abristempoacr"             # 5–50 alphanum, unique
$SQL="abristempo-sql-unique"     # nom de serveur SQL GLOBALEMENT unique
$DB="AbrisTempoDb"
$APP="abristempo-api"; $CAE="abristempo-cae"
$ADMIN="sqladmin"; $SQLPWD="<MotDePasseFort!>"   # garde-le pour la connection string
$JWT="<CLE_JWT_FORTE_min_32_caracteres>"

az login
az group create -n $RG -l $LOC

# 1. Azure SQL : serveur + base S0 (gratuite 12 mois) + pare-feu « services Azure »
az sql server create -n $SQL -g $RG -l $LOC -u $ADMIN -p $SQLPWD
az sql db create -g $RG -s $SQL -n $DB --service-objective S0
az sql server firewall-rule create -g $RG -s $SQL -n AllowAzure `
  --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0

# 2. Container Registry + première image (depuis la racine du dépôt)
az acr create -n $ACR -g $RG --sku Basic
az acr build -r $ACR -t abristempo-api:initial -f Dockerfile .

# 3. Environnement + Container App
az extension add -n containerapp --upgrade
az containerapp env create -n $CAE -g $RG -l $LOC
$CS="Server=tcp:$SQL.database.windows.net,1433;Database=$DB;User ID=$ADMIN;Password=$SQLPWD;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
az containerapp create -n $APP -g $RG --environment $CAE `
  --image "$ACR.azurecr.io/abristempo-api:initial" --registry-server "$ACR.azurecr.io" `
  --target-port 8080 --ingress external --min-replicas 0 --max-replicas 1 `
  --secrets "connstr=$CS" "jwtkey=$JWT" `
  --env-vars ASPNETCORE_ENVIRONMENT=Production ASPNETCORE_FORWARDEDHEADERS_ENABLED=true `
             Database__MigrateOnStartup=true `
             ConnectionStrings__DefaultConnection=secretref:connstr Jwt__Key=secretref:jwtkey
```
> **`ASPNETCORE_FORWARDEDHEADERS_ENABLED=true` est indispensable** : l'ingress termine le TLS et
> transmet `X-Forwarded-Proto: https`. Sans ce flag, `UseHttpsRedirection()` (actif hors dev) voit
> du HTTP et **boucle en 307**. (Aucun code à changer — flag natif ASP.NET Core.)
> *Repli :* si la boucle 307 persiste **malgré** le flag, c'est que `ForwardedHeadersOptions` ne
> fait par défaut confiance qu'aux proxys loopback (l'ingress Envoy ne l'est pas) — ajouter alors
> en code `app.UseForwardedHeaders(...)` avec `KnownNetworks`/`KnownProxies` vidés. Non requis sur
> le chemin nominal Container Apps.

#### CD automatique — service principal + secret GitHub
```powershell
$SUB = az account show --query id -o tsv
$SP = az ad sp create-for-rbac --name abristempo-gh --role contributor `
  --scopes /subscriptions/$SUB/resourceGroups/$RG --sdk-auth   # → JSON
gh secret set AZURE_CREDENTIALS --body "$SP"
# Droit de push ACR pour le SP :
$APPID = az ad sp list --display-name abristempo-gh --query "[0].appId" -o tsv
az role assignment create --assignee $APPID --role AcrPush `
  --scope $(az acr show -n $ACR --query id -o tsv)
# (optionnel) si tes noms diffèrent des défauts du workflow :
gh variable set AZURE_RESOURCE_GROUP --body $RG
gh variable set AZURE_ACR_NAME --body $ACR
gh variable set AZURE_CONTAINERAPP_NAME --body $APP
```

#### Brancher le frontend sur l'API
```powershell
$FQDN = az containerapp show -n $APP -g $RG --query properties.configuration.ingress.fqdn -o tsv
```
1. `src/AbrisAutoOutaouais-WebApp.Client/src/environments/environment.prod.ts` →
   `apiUrl: 'https://<FQDN>/api/v1'` (remplace le placeholder).
   ⚠️ **Ne pousse PAS `master` tant que ce placeholder n'est pas substitué** : le workflow front
   (SWA) n'est pas filtré par `paths`, donc tout push redéploierait le front avec une API morte.
2. `AllowedOrigins` (`appsettings.Production.json`) contient déjà l'URL SWA — vérifie qu'elle
   correspond à ton domaine SWA réel.
3. Pousse sur `master` → **front** (SWA) **et** **API** (Container Apps) redéploient via leurs
   workflows respectifs.

#### Vérifier
- `GET https://<FQDN>/api/v1/...` répond (1ʳᵉ requête = réveil du conteneur, scale-to-zero).
- Les tables sont créées (migration au démarrage) et le compte admin seedé.
- Le front prod appelle l'API sans erreur CORS (origine SWA autorisée).

## 5. Base de données
- **Container Apps (recommandé ci-dessus)** : migration **automatique au démarrage** via
  `Database__MigrateOnStartup=true` (le conteneur applique les migrations en attente avant les
  seeders ; `MigrateAsync` prend un verrou applicatif → sûr en multi-réplicas).
- **Autres hôtes / migration manuelle** : appliquer les migrations EF Core au déploiement —
  `dotnet ef database update --connection "$Env:ConnectionStrings__DefaultConnection"`
  (ou un script idempotent : `dotnet ef migrations script --idempotent -o migrate.sql`).
