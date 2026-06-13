import {
  DestroyRef,
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
 * Effet « aimant » : l'élément suit légèrement le pointeur au survol (E3, Redesign v2).
 *
 * Garde-fous a11y / utilisabilité :
 * - Activé UNIQUEMENT pour un pointeur fin (`matchMedia('(pointer:fine)')`) — jamais au tactile.
 * - Désactivé sous mouvement réduit (MotionService).
 * - L'effet n'agit qu'au survol POINTEUR : au focus clavier l'élément reste à sa place (le
 *   transform est remis à zéro sur `pointerleave`), donc la cible ne « fuit » jamais le clic ni
 *   le focus. Le déplacement est borné (faible amplitude) — l'élément demeure toujours cliquable.
 * - SSR-safe : aucun écouteur posé côté serveur.
 */
@Directive({
  selector: '[appMagneticHover]',
})
export class MagneticHoverDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly motionService = inject(MotionService);
  private readonly destroyRef = inject(DestroyRef);

  /** Intensité du suivi (0–1) : fraction du décalage pointeur↔centre appliquée en translation. */
  readonly magneticStrength = input(0.3);

  constructor() {
    afterNextRender(() => this.init());
  }

  private init(): void {
    if (!this.isBrowser) {
      return;
    }
    // Pointeur grossier (tactile) ou mouvement réduit : aucun effet.
    const finePointer = window.matchMedia?.('(pointer:fine)').matches ?? false;
    if (!finePointer || this.motionService.prefersReducedMotion()) {
      return;
    }

    const el = this.host.nativeElement;
    const onMove = (event: PointerEvent): void => this.follow(event);
    const onLeave = (): void => this.reset();

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);

    this.destroyRef.onDestroy(() => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    });
  }

  private follow(event: PointerEvent): void {
    const el = this.host.nativeElement;
    const rect = el.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const strength = this.magneticStrength();
    el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
  }

  private reset(): void {
    // Retour à la position d'origine : l'élément reste cliquable et stable au focus clavier.
    this.host.nativeElement.style.transform = '';
  }
}
