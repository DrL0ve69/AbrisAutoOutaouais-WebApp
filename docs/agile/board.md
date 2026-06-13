# Tableau Scrum / Kanban — AbrisTempo Local (snapshot)

> Instantané du tableau en **début de Sprint 4** (après livraison des Sprints 1–3).
> Colonnes : **Backlog** → **À faire** (engagé ce sprint) → **En cours** → **Revue** → **Terminé**.
> Items réels du projet ; identifiants alignés sur `product-backlog.md`. Terminologie Azure
> DevOps (Story / Task / Bug).

## Vue d'ensemble

| Backlog | À faire | En cours | Revue | Terminé |
|---------|---------|----------|-------|---------|
| US-6.2 Checkout + révision | US-2.7 Retirer auth legacy | US-1.5 Recherche & tri catalogue | US-3.7 Étendre couverture axe e2e | US-1.1 Parcourir par catégorie |
| US-6.3 Réservation installation | US-1.6 Page panier révisable | | | US-1.2 Détail produit |
| US-6.4 Location saisonnière | US-3.6 Cibles tactiles ≥ 44px (chips) | | | US-1.3 Ajout au panier |
| US-2.6 Réinitialisation mot de passe | Bug-07 Menus fermables (`Échap`/clic ext.) | | | US-1.4 Seed produits/catégories |
| | | | | US-2.1 → 2.5 Auth + profil |
| | | | | US-3.1 → 3.5 A11y socle |
| | | | | US-4.1 i18n balisage |
| | | | | US-4.2/4.3 Bascule FR/EN + build localisé `/en/` |
| | | | | US-5.1/5.2/5.4 Thème |

---

## Détail des cartes actives (Sprint 4)

### À faire (engagé)
| ID | Titre | Type | Points | Critère « Done » clé |
|----|-------|------|:------:|----------------------|
| US-2.7 | Retirer les composants d'auth legacy (`login.ts`, `register.component.ts`) ; router tout sur `/auth` | Task techn. | 2 | Aucune route ne charge le legacy ; e2e auth verte |
| US-1.6 | Page panier révisable (modifier quantités, retirer un item) | Story | 8 | Étape révision (3.3.4) ; états annoncés ; axe 0 |
| US-3.6 | `min-height: 44px` sur `.catalog__chip` (`catalog.scss`, `home.scss`) | Task a11y | 2 | Cibles ≥ 44px vérifiées mobile |
| Bug-07 | Menus navbar non fermables au clavier (`Échap` + clic extérieur) | Bug | 3 | Fermeture + retour de focus au déclencheur |

### En cours
| ID | Titre | Type | Points | Assigné |
|----|-------|------|:------:|---------|
| US-1.5 | Recherche textuelle + tri (prix/dispo) + pagination serveur | Story | 5 | P. Charron |

### Revue
| ID | Titre | Type | Points | En attente de |
|----|-------|------|:------:|---------------|
| US-3.7 | Ajouter `/auth`, `/mon-compte/profil`, états d'erreur aux scénarios Playwright axe | Story | 3 | Revue de code + CI verte |

---

## Bugs résolus (référence — Sprint 3)

| ID | Titre | Critère WCAG | Correctif |
|----|-------|--------------|-----------|
| Bug-01 | Contraste footer / why-us < 4.5:1 | 1.4.3 | Palette `_tokens.scss` (ratios documentés) |
| Bug-02 | Skip-link disparaît à l'hydratation SSR | 2.4.1 | Visually-hidden-until-focus (`styles.scss`) |
| Bug-03 | Champs natifs illisibles en mode sombre OS | 1.4.3 / 1.4.11 | `color-scheme` light/dark (`_tokens.scss`) |
| Bug-04 | Focus indésirable sur `main` après skip | 2.4.7 | `main#main:focus { outline:none }` (`app.scss`) |
| Bug-05 | Dropdown navbar sous le contenu | 1.4.11 | Échelle `z-index` tokenisée |
| Bug-06 | Champ login refusait les noms d'utilisateur | 3.3.8 | Retrait de `Validators.email` (`auth.ts`) |

---

## Indicateurs du tableau

- **WIP limit** (En cours) : 2 — respecté (1 item en cours).
- **Cartes Terminées (Sprints 1–3)** : 20+ stories, 5 bugs a11y corrigés.
- **Lead time moyen** d'une story : ~ 4 jours ouvrés.
- **Ratio Bug / Story** : faible (5 bugs sur ~20 stories), concentré sur l'a11y détectée et corrigée **dans le même sprint**.

> Le tableau reflète une **a11y/UX traitée en flux continu** : les bugs d'accessibilité sont
> ouverts, priorisés et fermés au fil de l'eau (Bug-01→06), et les améliorations UX issues de
> l'évaluation heuristique alimentent directement le backlog (Bug-07, US-1.5, US-3.6).

---

## Mise à jour — clôture du Sprint 4 (2026-06-11)

Remédiations livrées à partir des évaluations UX/WCAG (boucle *audit → correctif → vérification → re-documentation*) :

| ID | Titre | Critère / Heuristique | Correctif | Statut |
|----|-------|-----------------------|-----------|--------|
| Bug-07 | Menus navbar fermables au clavier | H3 / WCAG 2.1.2 | Fermeture `Échap` + clic extérieur + **renvoi de focus** au déclencheur (`navbar.ts`, pattern disclosure) | ✅ Terminé |
| US-2.7 | Retrait de l'auth legacy | H4 / R1 | Suppression de `features/auth/login/` et `features/auth/register/` (code mort, aucune route) | ✅ Terminé |
| US-1.5 | Recherche + tri catalogue | H7 | Champ `role="search"` + tri (prix/nom/dispo) + annonce de résultats `role="status"` (`catalog.ts`) | ✅ Terminé |
| US-3.6 | Cibles tactiles ≥ 44px | 2.5.8 | `min-height: 44px` sur `.catalog__chip` + champs de la barre d'outils | ✅ Terminé |
| US-3.7 | Couverture axe e2e étendue | R3 | Scénarios `/auth` et `/panier` ajoutés à `e2e/a11y.spec.ts` | ✅ Terminé |
| — | Onglets profil au clavier | Task-flow T3 / ARIA APG | Roving `tabindex` + flèches + Home/End (`profile.ts`) | ✅ Terminé |
| — | Fil d'Ariane détail produit | H6 | Breadcrumb `Accueil / Boutique / Catégorie / Produit` (`product-detail.html`) | ✅ Terminé |
| — | Home dédupliquée | H8 | Section catalogue dupliquée retirée — vedettes + renvoi vers `/boutique` | ✅ Terminé |
| — | Logo évoquant un abri | H2 | Glyphe `⬡` remplacé par une icône d'abri (navbar + auth/reset) | ✅ Terminé |
| US-2.6 | Mot de passe oublié | H9 / Task-flow T2 | Page `/auth/reset` accessible (confirmation neutre anti-énumération) + **backend de bout en bout livré** (Épic B2, voir ci-dessous) | ✅ Terminé |
| — | Ancres non masquées | 2.4.11/2.4.12 (R7) | `scroll-padding-top` + `scroll-margin-top` (navbar sticky) | ✅ Terminé |

> Vérification : `npm run build` ✅, `npm test` (33/33) ✅. Drift corrigé au passage — `installation`/`location` sont désormais de **vrais formulaires** de réservation/location et le panier/caisse existent (les anciens « placeholders » des audits sont obsolètes).

---

## Nouveaux éléments détectés — backlog (Sprint 5)

| ID | Titre | Type | Critère WCAG | Détecté par | Statut |
|----|-------|------|--------------|-------------|--------|
| Bug-08 | Menu utilisateur de la navbar : `<ul role="menu" aria-hidden="true">` conserve des enfants **focusables** une fois fermé (`opacity:0; pointer-events:none` au lieu de `inert`/`display:none`) → violation axe `aria-hidden-focus` sur **toute page authentifiée** | Bug a11y | 4.1.2 (Name, Role, Value) | e2e d'annulation de location (`rental-cancel.spec.ts`) | ✅ Corrigé (branche `fix/a11y-contrast-dark-theme`) |

> **Contexte.** Distinct de Bug-07 (fermeture clavier/clic — déjà corrigé) : ici le menu *fermé*
> restait dans l'ordre de tabulation tout en étant `aria-hidden`.
> **Correctif appliqué** : `[inert]="!userMenuOpen()"` sur le menu déroulant utilisateur **et**
> sur le menu mobile (même patron fautif) — `aria-hidden` retiré, `inert` retire les enfants de
> l'ordre de tabulation et de l'arbre d'accessibilité. Garde de régression : `navbar.spec.ts`
> (assertions de focus réelles, 6 tests) ; l'exclusion `app-rentals` de l'axe pleine page dans
> `rental-cancel.spec.ts`, devenue obsolète, a été **retirée** — la navbar authentifiée est
> désormais couverte par axe.

---

## Mise à jour — clôture de l'Épic B « Sections manquantes » (2026-06-13)

Branche `feat/missing-sections`. Boucle *architecte → développeur → revue indépendante → mentor*.

| ID | Titre | Critère / Heuristique | Correctif | Statut |
|----|-------|-----------------------|-----------|--------|
| B1 | Pages légales | H10 / RGPD-like | `/conditions`, `/confidentialite`, `/accessibilite` (résume l'audit WCAG réel) — routes paresseuses, i18n fr/en | ✅ Terminé |
| B2 | Réinitialisation du mot de passe | H9 / Task-flow T2 | `forgot-password` (202 anti-énumération) + `reset-password` `[AllowAnonymous]`, `IEmailService` (stub journalisé), round-trip couvert en IT | ✅ Terminé |
| B3 | Admin réservations / locations / utilisateurs | — | Queries + commandes (transitions légales) ; pages clonées sur la data-table a11y ; tuiles du tableau de bord remplacent « Section en construction » | ✅ Terminé |
| B4-H1 | Confirmation du changement de langue | H1 | Marqueur `sessionStorage` + annonce `role="status"` polite à la locale servie (SSR-safe) | ✅ Terminé |
| B4-H5 | Vérification de disponibilité | H5 | `GET api/v1/auth/availability` + validateurs async debouncés (400 ms) sur l'inscription | ✅ Terminé |
| B4-FAQ | FAQ accessible | H10 | Accordéon `<details>/<summary>` sur `/installation` et `/location` (incl. « autres marques sauf ShelterLogic ») | ✅ Terminé |

> **Revue indépendante** (l'implémenteur ne valide pas son propre diff) : **APPROVE WITH NITS**
> (2 nits optionnels, non bloquants). Leçon capturée : **L-010** (une live-region ARIA globale casse
> les locators `getByRole` non scopés des specs sans rapport).
> **Vérification** : `dotnet test` UT 106 / IT 59 ✅ (intégration désormais en CI), `npm test` 100
> (zéro violation axe) ✅, `npm run e2e` 48 ✅.
> **Suite immédiate** : mini-cycle « marque/modèle sur `BookingSlot` + exclusion ShelterLogic »
> (Domain + migration EF), puis Épic C (adresse structurée + autocomplétion).
