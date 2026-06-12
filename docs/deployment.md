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

- **Azure App Service (Node)** — déployer l'artifact `client` (= `dist/abristempo-client`),
  **commande de démarrage** `node serve-i18n.mjs` (depuis la racine de l'artifact ; `PORT` est
  fourni par App Service). Vérifiable en local : `npm run build:i18n && npm run preview:i18n`.
- **Azure Static Web Apps / autre statique** — servir `browser/` avec une règle de *fallback*
  équivalente (`/en/*` → `/en/index.csr.html`, sinon `/index.csr.html`).

> Le job *Frontend* du pipeline produit déjà l'artifact `client` (build `prod` localisé fr + en,
> hôte inclus) ; il reste à brancher l'étape de déploiement et la commande de démarrage ci-dessus.
>
> *Suivi possible (SEO) :* rendu **SSR par locale** — les bundles `server/server.mjs` (fr) et
> `server/en/server.mjs` (en) existent, mais composer les deux derrière une origine unique
> (montage par baseHref) reste à faire et à vérifier ; l'hôte statique ci-dessus est la solution
> livrée et testée.

## 5. Base de données
- Appliquer les migrations EF Core lors du déploiement :
  `dotnet ef database update --connection "$Env:ConnectionStrings__DefaultConnection"`
  (ou un script de migration généré : `dotnet ef migrations script --idempotent`).
