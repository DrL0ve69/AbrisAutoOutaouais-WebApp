# Décisions « motion » — Redesign v2 (E2 Hero scroll story)

> Référentiel des choix d'animation/défilement et de leur contrat d'accessibilité.
> Mis à jour lors de l'Épic E (Redesign v2). Source de vérité pour E5 (Playwright).

## Bibliothèque retenue : GSAP + ScrollTrigger (sans Lenis)

- **GSAP 3** (paquet unique `gsap`, gratuit y compris `ScrollTrigger`) pilote la révélation
  des 4 couches du récit pendant que la section est épinglée (`pin` + `scrub`).
- **Lenis (smooth-scroll) volontairement écarté.** Le défilement « lissé » par JS détourne le
  scroll natif (scroll-hijacking) : risque d'accessibilité (perte de repères, conflit avec les
  technologies d'assistance et le défilement clavier/molette de l'OS, WCAG 2.2.2/2.3). Le scroll
  natif + `scrub` GSAP suffit pour synchroniser l'animation au défilement sans confisquer le
  contrôle de l'utilisateur.

## Contrat « mouvement réduit » (`prefers-reduced-motion: reduce`)

- Branche JS (`gsap.matchMedia`) : **aucun `pin` ni `scrub`**, la **scène finale est figée**
  (toutes les couches `opacity: 1`, transforms nettoyées). `data-motion="reduced"` reflété sur
  la racine.
- **Repli CSS** (ceinture + bretelles) : `@media (prefers-reduced-motion: reduce)` neutralise
  `transition`/`will-change` — garantit la scène finale visible même si le JS ne s'exécute pas
  (SSR, échec de chargement du chunk, JS désactivé).
- Mode normal : `data-motion="on"`, `pin` + `scrub` actifs.

## Stratégie CLS (Cumulative Layout Shift)

- Le **serveur rend la section complète** : frame 1 = la composition finale (toutes les couches
  visibles via les défauts CSS — **aucun `opacity:0` en CSS**). Le h1 (LCP), les CTA et les stats
  occupent leur **boîte définitive dès la première peinture serveur** ; le hero est signifiant
  sans aucun JS.
- GSAP pose l'état **initial** (opacité/transform des couches décoratives) **côté client
  uniquement**, dans `afterNextRender` — jamais côté serveur.
- On réserve **`min-height: 100dvh`** sur le pin-wrap côté serveur, **sans** pré-réserver les
  300vh du pin (cela repousserait le pli et pénaliserait les utilisateurs en mouvement réduit).
  Le `pin-spacer` de GSAP grandit vers le bas **après hydratation** = comportement de défilement
  attendu, **pas du CLS au chargement**.
- On n'anime **jamais** la hauteur intrinsèque du hero ni la position de `.hero-story__content`
  au chargement — uniquement l'opacité/transform des couches décoratives.

## Hooks `data-*` exposés pour E5 (Playwright)

| Hook | Élément | Rôle |
|------|---------|------|
| `data-hero-story` | racine `<section>` | sélecteur de la section |
| `data-hero-svg` | `<svg>` (aria-hidden) | décor du récit |
| `[data-motion]` | racine | `'on'` \| `'reduced'` (mode effectif) |
| `data-layer="sol\|structure\|toile\|scene-finale"` | groupes `<g>` | 4 couches révélées |
| `data-beat` | légendes `<p>` (aria-hidden) | 4 temps du récit |

- `aria-labelledby="hero-heading"` + `<h1 id="hero-heading">` conservés intacts (L-008/L-010) :
  les locators de rôle/heading des autres specs ne sont pas affectés par le déplacement du markup.
- E5 doit vérifier le `pin`/`scrub` (progression du scroll), `[data-motion]` selon la préférence
  émulée, et l'absence de violation axe dans les deux thèmes.
