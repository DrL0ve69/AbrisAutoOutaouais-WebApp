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

## 4. Hébergement du frontend (SSR)

Le client Angular est en **SSR** (`@angular/ssr`). Options :
- **Azure Static Web Apps** — simple pour le bundle navigateur (le SSR nécessite des Functions).
- **Azure App Service (Node)** — héberger le serveur SSR : déployer `dist/abristempo-client`,
  commande de démarrage `node dist/abristempo-client/server/server.mjs`.
- **Vercel** — détection automatique d'Angular SSR (option historiquement prévue).

> Le job *Frontend* du pipeline produit déjà l'artifact `client` (build `prod` localisé fr + en) ;
> il reste à brancher l'étape de déploiement selon l'hébergeur choisi.

## 5. Base de données
- Appliquer les migrations EF Core lors du déploiement :
  `dotnet ef database update --connection "$Env:ConnectionStrings__DefaultConnection"`
  (ou un script de migration généré : `dotnet ef migrations script --idempotent`).
