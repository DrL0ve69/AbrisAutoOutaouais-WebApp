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

/**
 * Anneau de curseur personnalisé qui suit le pointeur (E3, Redesign v2).
 *
 * Contrainte DURE : on ne masque JAMAIS le curseur natif (`cursor:none` interdit) — l'anneau
 * s'AJOUTE par-dessus. Il est purement décoratif : host `aria-hidden="true"`, overlay
 * `pointer-events:none` (n'intercepte aucun clic, n'altère ni le focus ni les locators).
 *
 * Activé UNIQUEMENT pour un pointeur fin (`matchMedia('(pointer:fine)')`) ET hors mouvement réduit
 * (gardé à la fois côté TS via MotionService et côté CSS via media-query). SSR-safe : aucun
 * écouteur posé côté serveur ; le ring est positionné via `transform` (pas de reflow).
 */
@Component({
  selector: 'app-cursor-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #ring class="cursor-ring__dot"></div>`,
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

    const dot = this.ring().nativeElement;
    const onMove = (event: PointerEvent): void => {
      dot.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
      dot.style.opacity = '1';
    };
    const onLeave = (): void => {
      dot.style.opacity = '0';
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
    });
  }
}
