import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MotionService } from '../../../core/services/motion.service';

/** Sélecteur des éléments interactifs qui activent l'anneau magnétique. */
const INTERACTIVE_SELECTOR = 'a, button, [role="button"]';
/** Facteur de lissage (lerp) de l'anneau : plus bas = plus de retard/inertie. */
const RING_LERP_FACTOR = 0.18;
/** Seuil d'arrêt de la boucle rAF : sous cet écart, l'anneau est « arrivé ». */
const RING_EPSILON = 0.1;

/** Interpolation linéaire de `a` vers `b` d'un facteur `t`. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Curseur personnalisé à DEUX éléments (Programme G, Redesign v2) :
 *  - un POINT (`#dot`, ~8px) net qui suit le pointeur INSTANTANÉMENT (translate3d, aucune
 *    transition de position) ;
 *  - un ANNEAU (`#ring`, ~36px) fin qui suit en léger RETARD via une boucle rAF lerp, et qui
 *    GROSSIT (~56px) + prend une teinte douce au survol d'un élément interactif (`a, button,
 *    [role="button"]`) via la classe `cursor-ring__ring--active`.
 *
 * Contrainte DURE : on ne masque JAMAIS le curseur natif (`cursor:none` interdit) — point et
 * anneau s'AJOUTENT par-dessus. Purement décoratif : host `aria-hidden="true"`, overlay
 * `pointer-events:none` (n'intercepte aucun clic, n'altère ni le focus ni les locators).
 *
 * Activé UNIQUEMENT pour un pointeur fin (`matchMedia('(pointer:fine)')`) ET hors mouvement réduit
 * (gardé à la fois côté TS via MotionService et côté CSS via media-query). SSR-safe : aucun
 * écouteur posé côté serveur ; tout est positionné via `transform` (pas de reflow).
 */
@Component({
  selector: 'app-cursor-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #dot class="cursor-ring__dot"></div><div #ring class="cursor-ring__ring"></div>`,
  styleUrl: './cursor-ring.scss',
  host: {
    'aria-hidden': 'true',
    class: 'cursor-ring',
  },
})
export class CursorRingComponent {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly motionService = inject(MotionService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly dot = viewChild.required<ElementRef<HTMLElement>>('dot');
  private readonly ring = viewChild.required<ElementRef<HTMLElement>>('ring');

  constructor() {
    afterNextRender(() => this.init());
  }

  private init(): void {
    if (!this.isBrowser) {
      return;
    }
    const finePointer = window.matchMedia?.('(pointer:fine)').matches ?? false;
    if (!finePointer || this.motionService.prefersReducedMotion()) {
      return;
    }

    const dot = this.dot().nativeElement;
    const ring = this.ring().nativeElement;

    // État closure (pas de signaux : chemin chaud à chaque frame, on évite toute détection
    // de changement). Le point cible la position réelle du pointeur ; l'anneau converge vers
    // elle par lerp dans la boucle rAF.
    let targetX = 0;
    let targetY = 0;
    let ringX = 0;
    let ringY = 0;
    let rafId: number | null = null;
    let isActive = false;

    // Boucle d'animation de l'anneau : auto-arrêtée dès qu'il a rejoint la cible (économise
    // les frames quand le pointeur est immobile).
    const tick = (): void => {
      ringX = lerp(ringX, targetX, RING_LERP_FACTOR);
      ringY = lerp(ringY, targetY, RING_LERP_FACTOR);
      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;

      if (
        Math.abs(targetX - ringX) > RING_EPSILON ||
        Math.abs(targetY - ringY) > RING_EPSILON
      ) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = null;
      }
    };

    const onMove = (event: PointerEvent): void => {
      targetX = event.clientX;
      targetY = event.clientY;
      // Le point suit instantanément (aucune transition de position en CSS).
      dot.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
      dot.style.opacity = '1';
      ring.style.opacity = '1';
      if (rafId === null) {
        rafId = requestAnimationFrame(tick);
      }
    };

    const onLeave = (): void => {
      dot.style.opacity = '0';
      ring.style.opacity = '0';
      // Le pointeur quitte la fenêtre : on relâche l'état magnétique pour ne pas le figer
      // « actif » jusqu'au prochain survol au retour.
      if (isActive) {
        ring.classList.remove('cursor-ring__ring--active');
        isActive = false;
      }
    };

    // Survol magnétique délégué sur `document` : on bascule la classe seulement quand l'état
    // change réellement (anti-spam : pas de reflow inutile à chaque `pointerover`).
    const updateActive = (event: PointerEvent): void => {
      const target = event.target as Element | null;
      const shouldBeActive = target?.closest(INTERACTIVE_SELECTOR) != null;
      if (shouldBeActive !== isActive) {
        ring.classList.toggle('cursor-ring__ring--active', shouldBeActive);
        isActive = shouldBeActive;
      }
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave, { passive: true });
    document.addEventListener('pointerover', updateActive, { passive: true });
    document.addEventListener('pointerout', updateActive, { passive: true });

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('pointerover', updateActive);
      document.removeEventListener('pointerout', updateActive);
      // Une boucle rAF non annulée = zombie qui survit au composant.
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    });
  }
}
