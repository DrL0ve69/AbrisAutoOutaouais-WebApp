# Plan de sprints — AbrisTempo Local

> Trois sprints mappant le **travail réellement livré**, en terminologie **Azure DevOps**
> (Epic → Feature → User Story → Task → Bug). Cadence : sprints de 2 semaines.
> La preuve de chaque livraison renvoie au code (`src/.../*`) ou à l'historique git.

**Convention DevOps**
- **Epic** : grand thème produit (cf. `product-backlog.md`).
- **Feature** : sous-ensemble livrable d'un Epic.
- **User Story** : valeur utilisateur (US-x.y).
- **Task** : travail technique d'implémentation.
- **Bug** : défaut corrigé en cours de sprint.

---

## Sprint 1 — Catalogue & amorçage des données

**Objectif de sprint** : *« Un visiteur peut parcourir un catalogue d'abris alimenté, filtrer
par catégorie, consulter un produit et l'ajouter au panier. »*

**Périmètre**

| Type | Item | Réf. |
|------|------|------|
| Epic | Catalogue & vitrine produits | EPIC 1 |
| Feature | Catalogue filtrable + détail produit | — |
| User Story | US-1.1 Parcourir par catégorie | `features/shop/catalog/catalog.ts` |
| User Story | US-1.2 Détail produit | `features/shop/product-detail/product-detail.ts` |
| User Story | US-1.3 Ajout au panier | `cart.service.ts`, `toast.service.ts` |
| User Story | US-1.4 Seed produits/catégories | `Application/Products/*`, seeder backend |
| Task | Composant réutilisable `ProductCardComponent` | `shared/components/product-card` |
| Task | `ProductService` + modèles DTO + tests | `core/services/product.service.spec.ts` |
| Task | Skeletons de chargement (`aria-busy`) | `catalog.html`, `home.html` |

**Vélocité** : 16 points engagés / 16 livrés.
**Increment démontrable** : `/boutique` fonctionnel avec données seedées ; cartes accessibles.

**Rétrospective**
- 👍 *Garder* : composant `ProductCardComponent` mutualisé dès le départ → réutilisable.
- 👎 *Améliorer* : la home a fini par dupliquer un rendu de catalogue distinct → dette de cohérence à résorber (cf. heuristique H8).
- 🔧 *Action* : standardiser tout affichage produit sur `ProductCardComponent` au sprint suivant (reportée — voir Sprint 3 backlog).

---

## Sprint 2 — Authentification, profil & sécurité

**Objectif de sprint** : *« Un client peut s'inscrire (courriel + nom d'utilisateur), se
connecter par l'un ou l'autre, et gérer son profil (infos, adresse, mot de passe) en toute
sécurité. »*

**Périmètre**

| Type | Item | Réf. |
|------|------|------|
| Epic | Authentification & compte | EPIC 2 |
| Feature | Carte d'auth *flip* (login/register) | `features/auth/auth.ts` |
| Feature | Espace « Mon compte » à onglets | `features/account/profile/profile.ts` |
| User Story | US-2.1 Inscription (mot de passe fort) | `auth.ts` (`passwordsMatch`, patterns) |
| User Story | US-2.2 Connexion courriel OU username | `auth.ts` (champ sans `Validators.email`) |
| User Story | US-2.3/2.4/2.5 Profil infos/adresse/sécurité | `profile.html` (onglets ARIA) |
| Task | `authGuard` / `publicGuard` / `adminGuard` | `core/guards/*` |
| Task | Intercepteurs JWT / erreurs HTTP | `core/interceptors/*` |
| Task | Tests xUnit backend (handlers) | `AbrisAutoOutaouais-WebApp.UnitTest` |
| Bug | Champ login refusait les noms d'utilisateur (`Validators.email`) | corrigé dans `auth.ts` |

**Vélocité** : 17 points engagés / 15 livrés (US-2.6 *reset password* reportée).
**Increment démontrable** : parcours d'inscription/connexion complet → redirection `/mon-compte/profil`.

**Rétrospective**
- 👍 *Garder* : patron de champ commun (`.field`/`.field__error`/`.field__hint`) → erreurs accessibles uniformes.
- 👎 *Améliorer* : d'anciens écrans (`login.ts`, `register.component.ts`) n'ont pas été supprimés → **deux implémentations** d'auth, incohérence a11y (Bug latent / dette).
- 🔧 *Action* : créer US-2.7 « retirer l'auth legacy » et la planifier ; ajouter le nettoyage à la Definition of Done.

---

## Sprint 3 — Accessibilité, UX, i18n & thème

**Objectif de sprint** : *« L'application atteint WCAG 2.2 AA sur les pages clés, est balisée
fr/en, propose un thème clair/sombre persistant, et dispose d'une chaîne de tests a11y
automatisée. »*

**Périmètre**

| Type | Item | Réf. |
|------|------|------|
| Epic | Accessibilité / i18n / Thème | EPIC 3, 4, 5 |
| Feature | Tests a11y automatisés (axe) | `src/testing/axe-helper.ts`, `e2e/a11y.spec.ts` |
| Feature | Thème clair/sombre tokenisé | `core/services/theme.service.ts`, `_tokens.scss` |
| Feature | Internationalisation fr/en | `angular.json` i18n, `src/locale/messages.en.xlf` |
| User Story | US-3.1 Skip-link | `shared/layout/skip-nav` |
| User Story | US-3.2 Focus visible | `styles.scss` `:focus-visible` |
| User Story | US-3.3 États annoncés (`aria-live`) | `auth.html`, `profile.html` |
| User Story | US-3.4 Suite axe unitaire + e2e | `home.a11y.spec.ts`, Playwright |
| User Story | US-3.5 Contrastes AA documentés | `_tokens.scss` (ratios) |
| User Story | US-4.1 Balisage i18n | balises `@@id` partout |
| User Story | US-5.1/5.2/5.4 Thème + persistance + AA sombre | `ThemeService`, mixin `dark-theme` |
| Task | Audit clavier + NVDA/VoiceOver | rapport `docs/accessibility/wcag-2.2-audit.md` |
| Bug | Contraste footer / why-us < 4.5:1 | corrigé (palette `_tokens.scss`) |
| Bug | Skip-link disparaît à l'hydratation SSR | corrigé (visually-hidden-until-focus) |
| Bug | Champs natifs illisibles en sombre OS | corrigé (`color-scheme`) |
| Bug | Dropdown navbar passe sous le contenu | corrigé (échelle `z-index` tokens) |

**Vélocité** : 18 points engagés / 18 livrés.
**Increment démontrable** : 0 violation axe (Accueil/Boutique/Détail) ; bascule de thème AA ; chaînes balisées fr/en.

**Rétrospective**
- 👍 *Garder* : tests axe en CI (unitaire + e2e) → filet de sécurité anti-régression ; design tokens à ratios documentés.
- 👎 *Améliorer* : couverture e2e limitée à 3 pages (auth/profil non couverts) ; cibles tactiles des chips sous 44px.
- 🔧 *Action* : US-3.7 (étendre l'e2e) et US-3.6 (cibles 44px) ; prioriser au prochain sprint avec le checkout (EPIC 6).

---

## Tableau de bord (burn-up indicatif)

| Sprint | Points engagés | Points livrés | Reports | Bugs corrigés |
|--------|:--------------:|:-------------:|---------|:-------------:|
| 1 — Catalogue | 16 | 16 | — | 0 |
| 2 — Auth/Profil | 17 | 15 | US-2.6 | 1 |
| 3 — A11y/UX/i18n | 18 | 18 | — | 4 |
| **Total** | **51** | **49** | 1 story | 5 |

**Vélocité moyenne** : ~16 points / sprint. **Dette identifiée et tracée** : auth legacy
(US-2.7), couverture e2e (US-3.7), cibles tactiles (US-3.6), parcours transactionnels (EPIC 6).

---

## Intégration de l'accessibilité/UX dans le cycle Agile

Le rythme ci-dessus illustre une **a11y/UX intégrée à chaque sprint**, pas reléguée en fin de
projet :
- **Definition of Ready** : une story n'entre en sprint que si ses critères a11y sont explicités (voir `definition-of-ready.md`).
- **En cours de sprint** : tests axe écrits **avec** la fonctionnalité (ex. `home.a11y.spec.ts` versionné à côté du composant).
- **Definition of Done** : axe = 0 violation, i18n balisé, revue de code, build vert (voir `definition-of-done.md`).
- **Rétro** : chaque sprint produit des **actions de process** (retrait du legacy, extension e2e) — boucle d'amélioration continue.
