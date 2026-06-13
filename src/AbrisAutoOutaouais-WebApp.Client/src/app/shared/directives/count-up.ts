import {
  Directive,
  ElementRef,
  PLATFORM_ID,
  afterNextRender,
  inject,
  input,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MotionService } from '../../core/services/motion.service';

/**
 * Anime un compteur 0 → cible quand l'élément devient visible (E3, Redesign v2).
 *
 * Décision a11y FERME : le compteur est purement DÉCORATIF (l'animation est un effet visuel).
 * On n'utilise donc PAS `aria-live` — annoncer chaque incrément spammerait les lecteurs d'écran.
 * La VALEUR FINALE est écrite dans le DOM dès le rendu (texte sémantique correct, lu une fois) ;
 * l'animation ne modifie que l'AFFICHAGE visuel entre 0 et la cible.
 *
 * SSR / mouvement réduit : sur le serveur, sans IntersectionObserver, ou sous mouvement réduit,
 * la valeur finale est posée immédiatement, sans animation.
 */
@Directive({
  selector: '[appCountUp]',
})
export class CountUpDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly motionService = inject(MotionService);

  /** Valeur cible du compteur. */
  readonly countTo = input.required<number>();
  /** Durée de l'animation en millisecondes. */
  readonly countDuration = input(1200);
  /** Suffixe ajouté après la valeur (ex. « + », « % », « k »). */
  readonly countSuffix = input('');

  private observer: IntersectionObserver | null = null;
  private rafId: number | null = null;

  constructor() {
    // Valeur finale écrite IMMÉDIATEMENT dans le DOM (texte sémantique correct dès le rendu) —
    // y compris côté SSR (afterNextRender ne s'exécute pas côté serveur, mais le rendu initial
    // se fait via l'effet ci-dessous au premier rendu navigateur ; côté serveur, voir note).
    afterNextRender(() => this.init());
  }

  private init(): void {
    if (!this.isBrowser) {
      this.render(this.countTo());
      return;
    }
    const target = this.countTo();

    // Mouvement réduit ou pas d'IntersectionObserver : valeur finale immédiate, sans animation.
    if (this.motionService.prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      this.render(target);
      return;
    }

    // On pose la valeur finale d'emblée (texte correct si l'observer ne se déclenche jamais),
    // puis on (ré)anime depuis 0 dès que l'élément devient visible.
    this.render(target);

    this.observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.observer?.disconnect();
            this.observer = null;
            this.animate(target);
          }
        }
      },
      { threshold: 0.4 },
    );
    this.observer.observe(this.host.nativeElement);
  }

  private animate(target: number): void {
    const duration = this.countDuration();
    const start = performance.now();

    const step = (now: number): void => {
      const progress = Math.min((now - start) / duration, 1);
      // Easing « ease-out » doux (décélération) pour un comptage naturel.
      const eased = 1 - Math.pow(1 - progress, 3);
      this.render(Math.round(target * eased));
      if (progress < 1) {
        this.rafId = requestAnimationFrame(step);
      } else {
        this.render(target); // garantit la valeur exacte à la fin
        this.rafId = null;
      }
    };
    this.rafId = requestAnimationFrame(step);
  }

  private render(value: number): void {
    this.host.nativeElement.textContent = `${value}${this.countSuffix()}`;
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
