import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Hero « scroll story » — récit visuel d'une installation d'abri (E2, Redesign v2).
 *
 * Animation : au défilement, les 4 couches du SVG décoratif se révèlent en cascade
 * (« On ancre. » → « On structure. » → « On couvre. » → « Protégé tout l'hiver. »)
 * pendant que la section est épinglée (GSAP ScrollTrigger `pin` + `scrub`).
 *
 * SSR / CLS (risque #1) : AUCUN symbole `gsap`/`window`/`document` au niveau module — GSAP
 * est importé DYNAMIQUEMENT dans `afterNextRender` (jamais exécuté côté serveur). Le serveur
 * rend la SECTION COMPLÈTE (frame 1 = la composition finale, toutes les couches visibles via
 * les défauts CSS — PAS d'`opacity:0` en CSS) : le h1 (LCP), les CTA et les stats occupent
 * leur boîte définitive dès la première peinture serveur. GSAP pose l'état initial (opacité/
 * transform) UNIQUEMENT côté client. Le pin-spacer grandit après hydratation = comportement
 * de défilement attendu, PAS du CLS au chargement.
 *
 * Accessibilité : le SVG et les légendes (`data-beat`) sont `aria-hidden` — purement
 * décoratifs ; le contenu sémantique (h1/CTA/stats) est intégralement lu sans défilement ni JS.
 * `matchMedia('(prefers-reduced-motion: reduce)')` : aucun pin/scrub, scène finale figée
 * (doublé d'un repli CSS statique dans la feuille de styles). Interop CJS↔ESM normalisée
 * (`?? .default`) comme le correctif Leaflet de l'Épic D.
 *
 * Teardown : `mm.revert()` au `DestroyRef.onDestroy` (tue les ScrollTrigger + restaure le DOM).
 */
@Component({
  selector: 'app-hero-story',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hero-story.html',
  styleUrl: './hero-story.scss',
  imports: [RouterLink],
  host: {
    // `data-motion` reflété sur l'hôte (hook E5) ; `data-hero-story` est posé sur la
    // <section> elle-même (la racine épinglée + porteuse de aria-labelledby) — voir le template.
    '[attr.data-motion]': 'motion()',
  },
})
export class HeroStoryComponent {
  private readonly destroyRef = inject(DestroyRef);

  /** Racine épinglée par ScrollTrigger ; sert aussi de `trigger`. */
  private readonly root = viewChild.required<ElementRef<HTMLElement>>('root');

  /** Mode d'animation effectif, reflété sur l'hôte via `[attr.data-motion]` (hook E5). */
  protected readonly motion = signal<'on' | 'reduced'>('on');

  // GSAP n'est chargé que côté navigateur (import dynamique) : on type `mm` depuis l'API
  // `gsap.matchMedia()` (un `MatchMedia` qui expose `.add(...)` et `.revert()`).
  private mm: ReturnType<GsapApi['matchMedia']> | null = null;

  constructor() {
    afterNextRender(async () => {
      await this.initScrollStory();
    });
    this.destroyRef.onDestroy(() => this.mm?.revert());
  }

  private async initScrollStory(): Promise<void> {
    if (this.mm) return; // jamais ré-init

    // Import dynamique (navigateur uniquement) — aucun symbole au top-level (SSR-safe, L-006).
    // Interop CJS↔ESM : selon le bundler, l'API est exposée sur le namespace ou sous `.default`.
    // On normalise pour éviter le « X is not a function » observé en CI (cf. correctif Leaflet, Épic D).
    const gsapNs = await import('gsap');
    const gsap = gsapNs.default ?? gsapNs;
    const stNs = await import('gsap/ScrollTrigger');
    const ScrollTrigger = stNs.ScrollTrigger ?? stNs.default;
    gsap.registerPlugin(ScrollTrigger);

    const rootEl = this.root().nativeElement;
    const layers = '[data-layer]';
    const beats = rootEl.querySelectorAll<HTMLElement>('[data-beat]');

    this.mm = gsap.matchMedia();

    // ── Mouvement complet : pin + scrub, révélation en cascade des 4 couches ───────────
    this.mm.add('(prefers-reduced-motion: no-preference)', () => {
      this.motion.set('on');

      // État INITIAL posé côté client uniquement (jamais en CSS → frame 1 serveur = scène
      // finale, pas de CLS). On n'anime QUE l'opacité/transform des couches décoratives et
      // des légendes — JAMAIS la hauteur intrinsèque du hero ni la position du contenu.
      gsap.set(layers, { opacity: 0, y: 24 });
      gsap.set(beats, { opacity: 0, y: 12 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: rootEl,
          start: 'top top',
          end: '+=300%',
          scrub: 1,
          pin: true,
          pinSpacing: true,
          anticipatePin: 1,
        },
      });

      // Beats 1→4 : chaque couche apparaît, sa légende se fond en entrée puis en sortie,
      // sauf la dernière (« Protégé tout l'hiver. ») qui reste affichée jusqu'à la fin.
      const layerSel = rootEl.querySelectorAll<SVGGElement>('[data-layer]');
      layerSel.forEach((layer, i) => {
        const at = i; // une « unité » de timeline par couche
        tl.to(layer, { opacity: 1, y: 0, duration: 0.6 }, at);
        const beat = beats[i];
        if (beat) {
          tl.to(beat, { opacity: 1, y: 0, duration: 0.4 }, at);
          // Fondu de sortie de la légende avant la suivante (sauf la dernière).
          if (i < beats.length - 1) {
            tl.to(beat, { opacity: 0, duration: 0.3 }, at + 0.7);
          }
        }
      });

      return () => {
        tl.scrollTrigger?.kill();
        tl.kill();
      };
    });

    // ── Mouvement réduit : aucune animation, scène finale figée (doublé du repli CSS) ──
    this.mm.add('(prefers-reduced-motion: reduce)', () => {
      this.motion.set('reduced');
      gsap.set(layers, { opacity: 1, clearProps: 'transform' });
      gsap.set('[data-beat]', { opacity: 1, clearProps: 'transform' });
    });
  }
}

// API GSAP minimale utilisée (typée depuis le paquet, sans l'importer au top-level — SSR).
type GsapApi = (typeof import('gsap'))['default'];
