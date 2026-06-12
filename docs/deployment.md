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

## 5. Base de données
- Appliquer les migrations EF Core lors du déploiement :
  `dotnet ef database update --connection "$Env:ConnectionStrings__DefaultConnection"`
  (ou un script de migration généré : `dotnet ef migrations script --idempotent`).
