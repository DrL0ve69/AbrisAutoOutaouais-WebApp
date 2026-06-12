import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

export type AppLocale = 'fr' | 'en';

/**
 * Construit l'URL équivalente d'un emplacement dans la locale `lang`, en
 * préservant le chemin, la query et le fragment. Fonction pure (sans accès au
 * `window`) → testable isolément.
 *
 * @example
 *   localizedHref({ pathname: '/boutique', search: '', hash: '' }, 'en') // '/en/boutique'
 *   localizedHref({ pathname: '/en/panier', search: '?x=1', hash: '' }, 'fr') // '/panier?x=1'
 */
export function localizedHref(
  loc: { pathname: string; search: string; hash: string },
  lang: AppLocale,
): string {
  // Chemin « nu », débarrassé d'un éventuel préfixe « /en ».
  let path = loc.pathname.replace(/^\/en(?=\/|$)/, '');
  if (path === '') path = '/';
  const target = lang === 'en' ? (path === '/' ? '/en/' : `/en${path}`) : path;
  return `${target}${loc.search}${loc.hash}`;
}

/**
 * Gère la locale courante de l'application.
 *
 * L'i18n d'AbrisTempo est **compile-time** (`@angular/localize`) : chaque langue
 * est une application distincte servie sous un baseHref différent — le français
 * (locale source) à « / », l'anglais à « /en/ » (cf. `angular.json` →
 * `i18n.locales.en.baseHref`). Il n'y a donc PAS de bascule à chaud : changer de
 * langue = naviguer vers le build de l'autre locale.
 *
 * La détection se fait sur le **chemin** (et non `LOCALE_ID`, qui vaut « en-US »
 * par défaut dans un build non localisé — ex. `ng serve` de dev — et désignerait
 * à tort l'anglais alors que seul le français est servi).
 */
@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly platform = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);

  /** Locale actuellement servie (déduite du baseHref/chemin). */
  readonly current = signal<AppLocale>(this.detect());

  /** L'autre langue — celle vers laquelle le sélecteur fait basculer. */
  readonly other = computed<AppLocale>(() => (this.current() === 'fr' ? 'en' : 'fr'));

  /**
   * Bascule vers `lang` en rechargeant l'équivalent du chemin courant dans
   * l'autre locale (le chemin, la query et le fragment sont conservés). No-op
   * côté serveur (SSR) ou si on est déjà sur la langue demandée.
   */
  switchTo(lang: AppLocale): void {
    if (!isPlatformBrowser(this.platform) || lang === this.current()) return;
    this.document.defaultView!.location.href = localizedHref(
      this.document.defaultView!.location,
      lang,
    );
  }

  private detect(): AppLocale {
    if (!isPlatformBrowser(this.platform)) return 'fr';
    return this.document.defaultView!.location.pathname.startsWith('/en') ? 'en' : 'fr';
  }
}
