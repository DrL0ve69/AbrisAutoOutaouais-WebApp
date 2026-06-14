import {
  Directive,
  ElementRef,
  PLATFORM_ID,
  afterNextRender,
  computed,
  inject,
  input,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MotionService } from '../../core/services/motion.service';

/**
 * Révèle un élément en fondu/montée quand il entre dans la fenêtre (E3, Redesign v2).
 *
 * Contrat CLS / a11y (IMPORTANT) : l'état masqué initial (`opacity:0`) est posé en JS UNIQUEMENT,
 * via la classe `is-revealable` ajoutée au moment de l'init `afterNextRender`. On ne pose JAMAIS
 * `opacity:0` au repos en CSS : si le JS échoue ou côté SSR, le contenu reste pleinement visible
 * (pas de contenu invisible, pas de CLS). La transition vers l'état révélé se fait en ajoutant
 * `is-revealed` (cf. _animations.scss).
 *
 * SSR-safe : l'IntersectionObserver n'existe que côté navigateur (`isPlatformBrowser` +
 * `afterNextRender`). Sous mouvement réduit, l'élément est révélé immédiatement (aucune attente
 * d'intersection, doublé par le repli CSS).
 *
 * `data-motion` reflété sur l'hôte (`'on'|'reduced'`) — hook de débogage/CSS piloté par `MotionService`.
 */
@Directive({
  selector: '[appRevealOnScroll]',
  host: {
    '[attr.data-motion]': 'motion()',
  },
})
export class RevealOnScrollDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly motionService = inject(MotionService);

  /** Fraction de l'élément visible avant déclenchement (IntersectionObserver threshold). */
  readonly revealThreshold = input(0.15);
  /** Révèle une seule fois (par défaut) ; sinon re-masque quand l'élément ressort. */
  readonly revealOnce = input(true);

  protected readonly motion = computed<'on' | 'reduced'>(() =>
    this.motionService.prefersReducedMotion() ? 'reduced' : 'on',
  );

  private observer: IntersectionObserver | null = null;

  constructor() {
    afterNextRender(() => this.init());
  }

  private init(): void {
    if (!this.isBrowser) {
      return;
    }
    const el = this.host.nativeElement;

    // Mouvement réduit : aucun masquage ni animation — l'élément est révélé d'emblée.
    if (this.motionService.prefersReducedMotion()) {
      el.classList.add('is-revealed');
      return;
    }

    // État masqué initial posé en JS UNIQUEMENT (jamais en CSS au repos → pas d'invisibilité SSR).
    el.classList.add('is-revealable');

    // Pas d'IntersectionObserver (très vieux navigateur) : on révèle pour ne rien masquer.
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-revealed');
      return;
    }

    this.observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add('is-revealed');
            if (this.revealOnce()) {
              this.observer?.disconnect();
              this.observer = null;
            }
          } else if (!this.revealOnce()) {
            el.classList.remove('is-revealed');
          }
        }
      },
      { threshold: this.revealThreshold() },
    );
    this.observer.observe(el);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.observer = null;
  }
}
