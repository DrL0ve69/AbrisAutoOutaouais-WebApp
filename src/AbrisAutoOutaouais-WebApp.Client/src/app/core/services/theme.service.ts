import {
  DOCUMENT,
  Injectable,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'abristempo-theme';

/**
 * Gère le thème clair/sombre de l'application.
 *
 * Stratégie : :root porte le thème CLAIR, l'attribut `data-theme="dark"` sur
 * <html> active les surcharges sombres (voir _tokens.scss).
 *
 * - Persiste le choix dans localStorage.
 * - SSR-safe : sur le serveur, aucun accès à window/localStorage.
 * - Au démarrage : reprend le choix sauvegardé, sinon suit la préférence système.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  // Signal exposé pour l'UI (bouton de bascule, aria-pressed, etc.).
  readonly theme = signal<Theme>('light');

  constructor() {
    if (!this.isBrowser) {
      return;
    }
    this.theme.set(this.resolveInitialTheme());
    this.apply(this.theme());
  }

  /** Bascule entre clair et sombre et persiste le choix. */
  toggle(): void {
    this.setTheme(this.theme() === 'dark' ? 'light' : 'dark');
  }

  /** Applique un thème précis et le persiste. */
  setTheme(theme: Theme): void {
    this.theme.set(theme);
    if (!this.isBrowser) {
      return;
    }
    this.apply(theme);
    try {
      this.document.defaultView?.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage indisponible (mode privé) — on ignore silencieusement.
    }
  }

  private resolveInitialTheme(): Theme {
    let stored: string | null = null;
    try {
      stored = this.document.defaultView?.localStorage.getItem(STORAGE_KEY) ?? null;
    } catch {
      stored = null;
    }
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    const prefersDark =
      this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    return prefersDark ? 'dark' : 'light';
  }

  private apply(theme: Theme): void {
    // data-theme explicite → prioritaire sur prefers-color-scheme (cf. _tokens.scss).
    this.document.documentElement.setAttribute('data-theme', theme);
  }
}
