# Audit de conformité WCAG 2.2 niveau AA — AbrisTempo Local

> Application auditée : `AbrisAutoOutaouais-WebApp` (front-end Angular 21, SSR, i18n fr/en).
> Auditeur : Philippe Charron · Référentiel : **WCAG 2.2 niveaux A et AA**
> Méthode : tests automatisés (axe-core) + vérifications manuelles (clavier, lecteurs d'écran, zoom).

Ce document est un audit **fondé sur le code réel**. Chaque ligne cite le composant, le
fichier ou le jeton de design qui apporte la preuve, de manière à être vérifiable.

---

## 1. Méthodologie

L'évaluation combine **outils automatisés** et **tests manuels** — l'automatisation ne couvre
qu'environ 30 à 40 % des critères WCAG, le reste exige un jugement humain.

| Technique | Outil / preuve dans le dépôt | Couverture |
|-----------|------------------------------|------------|
| Tests axe-core unitaires (composant) | Vitest navigateur + `src/testing/axe-helper.ts` (tags `wcag2a/2aa/21a/21aa`) ; ex. `src/app/features/home/home.a11y.spec.ts` | Structure ARIA, rôles, noms accessibles, ordre des titres |
| Tests axe-core e2e (page complète) | `@axe-core/playwright` dans `e2e/a11y.spec.ts`, configuré par `playwright.config.ts` (app réelle servie par `ng serve`) | **Contraste de couleur inclus** (styles globaux chargés), a11y pleine page sur Accueil, Boutique, Détail produit |
| Audit Lighthouse | Onglet *Accessibility* (Chrome DevTools) sur build de production | Score global, libellés, contraste, ordre de tabulation |
| Navigation clavier manuelle | Tab / Maj+Tab / Entrée / Échap / flèches | Ordre logique, pièges de focus, focus visible, activation |
| Lecteurs d'écran | **NVDA** (Windows/Firefox), **VoiceOver** (macOS/Safari) | Annonces `aria-live`, noms/rôles/états, ordre de lecture |
| Zoom & reflow | Navigateur à **200 %** et **400 %** | Reflow sans perte de contenu (1.4.10), pas de défilement horizontal |
| Préférences système | `prefers-reduced-motion`, `prefers-color-scheme`, mode contraste élevé | Respect des animations réduites, thème sombre AA |

> **Nuance importante sur les tests unitaires** : la règle `color-contrast` est **désactivée
> au niveau composant** (`axe-helper.ts`) parce que les styles globaux (`styles.scss` +
> `_tokens.scss`) ne sont pas chargés dans le rendu unitaire — les couleurs n'y sont donc
> pas représentatives. Le contraste est validé **deux fois** : par les ratios documentés dans
> les design tokens, et par les tests **e2e Playmotion** qui n'inactivent PAS `color-contrast`
> (`e2e/a11y.spec.ts`, constante `WCAG_TAGS`).

---

## 2. Portée

| Page / zone | Route | Composant |
|-------------|-------|-----------|
| Accueil (hero, services, pourquoi nous, vedettes, catalogue, CTA) | `/` | `features/home/home.ts` |
| Boutique — catalogue filtrable | `/boutique` | `features/shop/catalog/catalog.ts` |
| Détail produit | `/boutique/:slug` | `features/shop/product-detail/product-detail.ts` |
| Authentification (connexion + inscription, carte *flip*) | `/auth` | `features/auth/auth.ts` |
| Profil / mon compte (onglets infos, adresse, sécurité) | `/mon-compte/profil` | `features/account/profile/profile.ts` |
| Navigation globale (navbar, skip-link, footer) | toutes | `shared/layout/{navbar,skip-nav,footer}` |
| Pages provisoires « en construction » | `/location`, `/installation` | `features/{location,installation}` |

Composants transverses audités : `shared/components/product-card`, `shared/components/alert`,
jeux de jetons `shared/styles/_tokens.scss` et `shared/styles/_a11y.scss`, styles globaux
`src/styles.scss`.

---

## 3. Tableau de conformance par principe (A / AA)

Statuts : **Conforme** · **À surveiller** (conforme mais fragile / dépend du contenu) · **N/A** (non applicable en l'état).

### 3.1 Principe 1 — Perceptible

| Critère | Niv. | Statut | Preuve (fichier / composant) |
|---------|------|--------|------------------------------|
| 1.1.1 Contenu non textuel | A | Conforme | `product-card.html` : `<img [alt]="product().name">` ; icônes SVG décoratives `aria-hidden="true"` (navbar, home, footer) ; placeholders emoji `aria-hidden` |
| 1.2.x Médias temporels | A/AA | N/A | Aucun audio/vidéo dans l'application |
| 1.3.1 Information et relations | A | Conforme | Hiérarchie `h1→h2→h3` respectée (`home.html`, `catalog.html` h1 unique) ; `<article>` pour les cartes ; `role="list"`, `role="group"`, `role="tablist/tab/tabpanel"` (`profile.html`) ; `<label for>` sur chaque champ |
| 1.3.2 Ordre séquentiel logique | A | Conforme | DOM linéaire, aucun réordonnancement visuel cassant l'ordre de lecture ; SSR rend l'ordre source |
| 1.3.4 Orientation | AA | Conforme | Aucune contrainte d'orientation ; grilles responsives (`@media min-width`) |
| 1.3.5 Identifier la finalité de la saisie | AA | Conforme | `autocomplete` présent : `email`, `current-password`, `new-password`, `given-name`, `family-name`, `tel`, `street-address`, `postal-code`, `address-level2` (`auth.html`, `profile.html`) |
| 1.4.1 Utilisation de la couleur | A | Conforme | Disponibilité = **icône + texte** (`✓ En stock` / `✗ Épuisé`), pas la couleur seule ; états de filtre via `aria-pressed` + libellé |
| 1.4.3 Contraste (minimum) | AA | Conforme | Jetons documentés ≥ 4.5:1 (`_tokens.scss`) : texte `#111827` 19:1, secondaire `#374151` 10.7:1, muted `#6b7280` 4.6:1, primaire `#b91c1c` 5.9:1 ; **validé par axe e2e** (`color-contrast` actif) |
| 1.4.4 Redimensionnement du texte | AA | Conforme | Unités `rem` partout (`_tokens.scss` échelle typographique) ; testé à 200 % sans perte |
| 1.4.10 Reflow | AA | Conforme | Layout fluide, grilles `repeat(auto/1fr)` ; pas de défilement horizontal à 320 px / 400 % |
| 1.4.11 Contraste des éléments non textuels | AA | Conforme | Bordures `--color-border-strong #d1d5db`, anneau de focus `--color-focus #1d4ed8` (8.6:1) ; états de boutons distincts |
| 1.4.12 Espacement du texte | AA | Conforme | `line-height` 1.6 corps, pas de hauteur fixe sur les conteneurs de texte |
| 1.4.13 Contenu au survol ou au focus | AA | À surveiller | Menu déroulant utilisateur (`navbar.html`) ouvert au clic (pas au survol) → conforme ; tooltips éventuels à vérifier si ajoutés |

### 3.2 Principe 2 — Utilisable

| Critère | Niv. | Statut | Preuve |
|---------|------|--------|--------|
| 2.1.1 Clavier | A | Conforme | Tous les contrôles sont des `<button>` / `<a>` natifs ; menu, onglets, filtres, thème, langue activables au clavier |
| 2.1.2 Pas de piège au clavier | A | Conforme | Aucune capture de focus permanente ; menus se ferment (`closeMenu`, `closeUserMenu`) |
| 2.4.1 Contourner des blocs | A | Conforme | **Skip-link** `shared/layout/skip-nav` → `#main` ; cible `main#main` focusable (`app.scss`) |
| 2.4.2 Titre de page | A | Conforme | `title` par route (`app.routes.ts` : Accueil, Location, Installation) ; router applique le titre (WCAG 2.4.2) |
| 2.4.3 Parcours du focus | A | Conforme | Ordre de tabulation = ordre DOM ; lien image de carte en `tabindex="-1"` pour éviter le **doublon de tabulation** (`product-card.html`) |
| 2.4.4 Fonction du lien (selon le contexte) | A | Conforme | Liens explicites + `aria-label` contextuels (`'Voir ' + product.name`, `aria-label` CTA hero) |
| 2.4.5 Accès multiples | AA | Conforme | Navigation principale + footer + recherche par catégorie (chips) ; plusieurs chemins vers chaque produit |
| 2.4.6 En-têtes et étiquettes | AA | Conforme | Titres descriptifs ; chaque champ a un `<label>` ; sections `aria-labelledby` |
| 2.4.7 Focus visible | AA | Conforme | `:focus-visible { outline: 3px solid var(--color-focus); outline-offset: 3px }` (`styles.scss`) ; anneau dédié sur chips et inputs |
| 2.5.1 Gestes du pointeur | A | Conforme | Aucun geste multipoint/trajectoire requis |
| 2.5.2 Annulation du pointeur | A | Conforme | Actions déclenchées au `click` (up), pas au `down` |
| 2.5.3 Étiquette dans le nom | A | Conforme | Le nom accessible des boutons contient le texte visible (« Se connecter », « Ajouter au panier »…) |
| 2.5.4 Activation par le mouvement | A | N/A | Aucune commande par mouvement de l'appareil |

> Les nouveaux critères WCAG 2.2 (2.4.11, 2.5.7, 2.5.8…) sont traités en **section 4**.

### 3.3 Principe 3 — Compréhensible

| Critère | Niv. | Statut | Preuve |
|---------|------|--------|--------|
| 3.1.1 Langue de la page | A | Conforme | i18n compile-time fr/en (`angular.json` : `sourceLocale: fr`, locale `en` baseHref `/en/`) → `lang` posé par build |
| 3.1.2 Langue d'un passage | AA | Conforme | Contenu monolingue par build ; pas de passages en langue étrangère non balisés |
| 3.2.1 Au focus | A | Conforme | Aucun changement de contexte au seul focus |
| 3.2.2 À la saisie | A | Conforme | Pas de soumission automatique ; navigation explicite (boutons) |
| 3.2.3 Navigation cohérente | AA | Conforme | Navbar/footer identiques sur toutes les pages (`shared/layout`) |
| 3.2.4 Identification cohérente | AA | Conforme | Mêmes icônes/libellés pour les mêmes fonctions (panier, thème, langue) |
| 3.3.1 Identification des erreurs | A | Conforme | Erreurs `role="alert"` reliées par `aria-describedby` (`login.html`, `auth.html`, `profile.html`) |
| 3.3.2 Étiquettes ou instructions | A | Conforme | Labels + champs `field__hint` (ex. format code postal `A1A 1A1`, règles de mot de passe) |
| 3.3.3 Suggestion après erreur | AA | Conforme | Messages spécifiques (« Minimum 8 caractères », « Format de courriel invalide », « ne correspondent pas ») |
| 3.3.4 Prévention des erreurs (juridique/financier) | AA | À surveiller | Profil/adresse réversibles ; **panier/paiement non encore implémentés** → à couvrir lors du checkout (confirmation, révision) |

### 3.4 Principe 4 — Robuste

| Critère | Niv. | Statut | Preuve |
|---------|------|--------|--------|
| 4.1.2 Nom, rôle, valeur | A | Conforme | `aria-pressed` (filtres/langue/thème), `aria-expanded`+`aria-controls` (menu, hamburger), `aria-selected`+`aria-controls` (onglets profil), `aria-busy`/`aria-disabled` (boutons), `role="menu/menuitem"` (dropdown) |
| 4.1.3 Messages d'état | AA | Conforme | `aria-live="polite"` pour succès profil et bascule login/register (`auth.html`, `profile.html`) ; `role="status"` pour disponibilité et états vides ; toasts via `ToastService` |

> **4.1.1 Analyse syntaxique** a été retiré de WCAG 2.2 (toujours conforme — Angular génère un DOM valide).

---

## 4. Nouveaux critères WCAG 2.2 — évaluation détaillée

| Critère | Niv. | Statut | Évaluation & recommandation |
|---------|------|--------|------------------------------|
| **2.4.11 Apparence du focus (minimum)** | AA | Conforme | L'anneau `outline: 3px + offset 3px` (`styles.scss`) n'est masqué par aucun conteneur à `overflow:hidden` problématique. **Reco** : surveiller le menu déroulant utilisateur — vérifier que le `z-index` du dropdown (`--z-dropdown: 200`) place bien l'élément focusé au-dessus du contenu sticky lors de la tabulation. |
| **2.4.12 Focus non masqué (amélioré)** | AAA | À surveiller | Hors périmètre AA, mais la navbar `position: sticky` pourrait masquer un élément focusé en haut de page après un saut d'ancre. **Reco** : ajouter `scroll-margin-top` égal à la hauteur de la navbar sur les cibles d'ancrage. |
| **2.4.13 Apparence du focus** | AAA | Partiel | L'épaisseur 3px et le contraste 8.6:1 dépassent déjà le seuil ; visé comme bonus, non requis en AA. |
| **2.5.7 Mouvements de glissement** | AA | Conforme | **Aucune** fonction ne repose sur un glissement (pas de carrousel à *swipe* obligatoire, pas de *slider* à glisser, pas de *drag-and-drop*). Les filtres sont des boutons. Critère satisfait par absence de geste de glissement. |
| **2.5.8 Taille de la cible (minimum 24×24)** | AA | **Conforme avec réserve** | Boutons standards : `min-height/min-width: 44px` (`styles.scss`, dépasse même l'AAA 2.5.5). **Point d'attention** : les **chips de filtre** (`.catalog__chip`, `catalog.scss`) ont `padding: 8px 16px` + texte 14px → hauteur ≈ 33 px : **conforme au minimum 24×24** mais sous le confort AAA 44 px. **Reco concrète** : porter les chips à `min-height: 44px` pour homogénéité tactile, surtout sur mobile où ils sont rapprochés. |
| **3.2.6 Aide cohérente** | A | Conforme | Le numéro de téléphone d'aide (`tel:+18191234567`) apparaît au **même endroit** (footer + bandeau CTA + page installation), dans le même ordre relatif. **Reco** : si un widget de contact/chat est ajouté, le placer de façon constante. |
| **3.3.7 Saisie redondante** | A | Conforme | Aucune ressaisie imposée dans une même session : l'adresse de livraison est **mémorisée au profil** et « sera pré-remplie lors de vos commandes » (`profile.html`, panel Adresse). **Reco** : au checkout, pré-remplir depuis le profil plutôt que redemander. |
| **3.3.8 Authentification accessible (minimum)** | AA | Conforme | Connexion par **courriel OU nom d'utilisateur** + mot de passe, avec `autocomplete="username"`/`current-password` → le **gestionnaire de mots de passe peut tout remplir** (`auth.ts` : pas de `Validators.email` sur le champ login ; `auth.html`). **Aucun test cognitif** (pas de CAPTCHA à résoudre, pas de transcription d'image, pas de puzzle). Critère satisfait. **Reco** : si un anti-spam est ajouté plus tard, privilégier une case honeypot invisible plutôt qu'un CAPTCHA visuel. |

---

## 5. Anomalies trouvées et corrigées (avant / après)

Ces correctifs sont **présents dans le code actuel** ; ils illustrent le cycle
détection → recommandation → remédiation → re-test.

### 5.1 Contraste insuffisant — footer & section « Pourquoi nous »
- **Critère** : 1.4.3 Contraste (AA).
- **Avant** : texte clair sur fonds bleu-nuit/crème en dessous de 4.5:1 (signalé par axe e2e `color-contrast`).
- **Après** : palette recalée dans `_tokens.scss` avec ratios documentés (`--color-text-secondary #374151` 10.7:1, `--color-accent #92400e` 7.1:1, variantes sombres `#f87171` ~5.1:1 sur `#0f1923`). Le footer affiche désormais « conforme WCAG AA » (`footer.html`).
- **Re-test** : `e2e/a11y.spec.ts` (Accueil) — `violations` attendu `[]`.

### 5.2 Skip-link — disparition pendant l'hydratation SSR
- **Critère** : 2.4.1 Contourner des blocs (A).
- **Avant** : `display:none` retirait le lien de l'ordre de tabulation et provoquait un saut visuel à l'hydratation.
- **Après** : technique **visually-hidden-until-focus** (`styles.scss` `.skip-link` : `position:fixed` + `transform: translateY(-150%)`, révélé sur `:focus`/`:focus-visible`) → reste dans l'ordre de tabulation, n'apparaît pas en SSR.
- **Re-test** : navigation clavier (1er Tab) + NVDA.

### 5.3 Champs natifs illisibles en mode sombre OS
- **Critère** : 1.4.3 / 1.4.11.
- **Avant** : en thème sombre système, `input`/`select`/autofill rendus « fond blanc / texte pâle » par le navigateur.
- **Après** : `color-scheme: light` sur `:root` et `color-scheme: dark` dans le mixin `dark-theme` (`_tokens.scss`) → contrôles natifs, scrollbars et autofill rendus selon le thème actif.
- **Re-test** : VoiceOver + macOS apparence sombre.

### 5.4 Focus invisible sur le `<main>` après skip-link
- **Critère** : 2.4.7 / 2.4.3.
- **Avant** : `main[tabindex="-1"]` recevait un anneau de focus indésirable au saut programmatique.
- **Après** : `main#main:focus { outline:none }` ciblé (`app.scss`) tout en conservant `:focus-visible` pour la navigation clavier réelle.

### 5.5 Z-index du menu déroulant de la navbar
- **Critère** : 1.4.11 / 2.4.11.
- **Avant** : le dropdown utilisateur passait sous les sections suivantes.
- **Après** : échelle de `z-index` formalisée dans les jetons (`--z-dropdown: 200`, `--z-sticky: 300`, `--z-modal: 500`) garantissant l'empilement correct du menu et du focus visible.

---

## 6. Risques résiduels & recommandations

| # | Constat | Critère lié | Recommandation concrète | Priorité |
|---|---------|-------------|--------------------------|----------|
| R1 | **Deux implémentations d'inscription coexistent** : `features/auth/auth.ts` (accessible, *flip*, `username`) et `features/auth/register/register.component.ts` (legacy `*ngIf`, libellés non i18n, sans `aria-invalid`/`aria-describedby`, styles inline gradient) | 3.3.1 / 4.1.2 / 3.1.2 | Supprimer le composant legacy `register.component.ts` ou le faire converger vers le patron `auth.html` ; éviter qu'une route le réintroduise | Haute |
| R2 | Chips de filtre sous 44 px de hauteur | 2.5.8 (AA ok) / 2.5.5 (AAA) | `min-height: 44px` sur `.catalog__chip` | Moyenne |
| R3 | Couverture axe **e2e limitée à 3 pages** (Accueil, Boutique, Détail) | Méthodo | Ajouter `/auth`, `/mon-compte/profil` et états d'erreur/vides aux scénarios Playwright | Moyenne |
| R4 | `color-contrast` désactivé en tests unitaires | Méthodo | Acceptable (documenté), mais s'appuyer sur l'e2e comme garde-fou de non-régression CI | Basse |
| R5 | Parcours panier / paiement / réservation **non implémentés** (`/location`, `/installation` = pages « en construction ») | 3.3.4 / 3.3.7 | Concevoir le checkout dès le départ avec étape de révision, pré-remplissage profil, et messages d'erreur reliés | Haute (futur) |
| R6 | Changement de langue = rechargement complet vers `/en/` (`navbar.ts switchLang`) | 3.2.3 | Annoncer le changement (page rechargée, focus repositionné) ; vérifier que le build `en` est servi (sinon EN inactif en `ng serve`) | Basse |
| R7 | `2.4.12` (focus non masqué par la navbar sticky lors des sauts d'ancre) | AAA | `scroll-margin-top` sur les cibles d'ancrage (`#catalogue`, `#main`) | Basse |

---

## 7. Synthèse

L'application atteint un **bon niveau de conformité WCAG 2.2 AA** sur les pages auditées :
sémantique HTML solide, ARIA correct (états, rôles, `aria-live`), focus visible, design tokens
à contraste documenté, i18n fr/en, et une **chaîne de tests d'accessibilité automatisée**
(axe unitaire + axe e2e Playwright) qui sert de garde-fou de non-régression. Les nouveaux
critères 2.2 sont majoritairement satisfaits **par conception** (pas de glissement, cibles
généreuses, authentification sans test cognitif, saisie non redondante via le profil).

Les actions prioritaires restantes sont la **suppression du composant d'inscription legacy**
(R1) et l'**extension de la couverture e2e** (R3), puis la conception accessible des parcours
panier/réservation à venir (R5).
