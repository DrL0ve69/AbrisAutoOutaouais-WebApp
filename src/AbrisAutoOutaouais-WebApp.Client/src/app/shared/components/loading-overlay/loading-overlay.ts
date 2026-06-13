import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';

/**
 * Indicateur global de chargement de page pendant la navigation (E3, Redesign v2).
 *
 * Écoute les événements du routeur : `NavigationStart` affiche l'overlay ;
 * `NavigationEnd` / `NavigationCancel` / `NavigationError` le masquent.
 *
 * A11y : ce N'EST PAS une modale — il ne vole PAS le focus, ne piège pas la tabulation et
 * laisse la page interactive. L'état est annoncé poliment via une région `role="status"`
 * `aria-live="polite"` portant un libellé `sr-only` (« Chargement de la page… »). Le visuel
 * (arche d'abri brandée) est `aria-hidden`. Sous mouvement réduit, le spinner est figé (CSS).
 */
@Component({
  selector: 'app-loading-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './loading-overlay.html',
  styleUrl: './loading-overlay.scss',
})
export class LoadingOverlayComponent {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly visible = signal(false);

  constructor() {
    const sub = this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.visible.set(true);
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.visible.set(false);
      }
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }
}
