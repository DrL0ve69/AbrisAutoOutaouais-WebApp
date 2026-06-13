import {
  DOCUMENT,
  Injectable,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Source de vérité TS (côté navigateur) pour la préférence « mouvement réduit » (E3, Redesign v2).
 *
 * Pourquoi un service partagé : les micro-interactions JS (révélation au défilement, compteurs,
 * survol magnétique, anneau de curseur) doivent toutes consulter la MÊME préférence, et réagir à
 * son changement à chaud. Le repli CSS `@media (prefers-reduced-motion: reduce)` reste le filet de
 * sécurité (mouvement coupé même si le JS échoue) ; ce signal est le miroir TS de cette media-query.
 *
 * SSR-safe : sur le serveur, aucun accès à `window`/`matchMedia` — le signal vaut `false` (défaut
 * neutre : le rendu serveur n'anime rien de toute façon, l'init mouvement se fait dans
 * `afterNextRender` côté client).
 */
@Injectable({ providedIn: 'root' })
export class MotionService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  /** `true` si l'utilisateur demande un mouvement réduit. Défaut SSR : `false`. */
  readonly prefersReducedMotion = signal<boolean>(false);

  constructor() {
    if (!this.isBrowser) {
      return;
    }
    const mql = this.document.defaultView?.matchMedia?.(REDUCED_MOTION_QUERY);
    if (!mql) {
      return;
    }
    this.prefersReducedMotion.set(mql.matches);
    // Réagit à la bascule système à chaud (l'utilisateur peut changer sa préférence sans recharger).
    mql.addEventListener('change', event => this.prefersReducedMotion.set(event.matches));
  }
}
