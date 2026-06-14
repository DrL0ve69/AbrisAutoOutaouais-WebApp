import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  computed,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { environment } from '../../../environments/environment';

export type AppLocale = 'fr' | 'en';

/**
 * Clé sessionStorage posée AVANT le rechargement pleine page du switch de langue,
 * relue au chargement suivant pour annoncer la confirmation, puis nettoyée (H1).
 */
const PENDING_SWITCH_KEY = 'locale-switch-pending';

/** Libellé natif de chaque langue, pour la confirmation « Langue changée : … ». */
const LOCALE_LABELS: Record<AppLocale, string> = { fr: 'Français', en: 'English' };

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
   * Vrai quand le build sert RÉELLEMENT les deux locales (prod/staging localisés),
   * faux en dev mono-locale (`ng serve`, seul le français existe). Drapeau injecté
   * au build via `environment` (import statique → SSR-safe, aucun accès `window`).
   * Quand il est faux, la bascule de langue est un no-op et le bouton est dégradé
   * (annoncé indisponible) plutôt que de rediriger silencieusement vers l'accueil fr.
   */
  readonly localized = computed(() => environment.localized);

  /**
   * Confirmation de changement de langue, annoncée via une région `aria-live`
   * (H1). Vide en temps normal ; renseignée une seule fois au chargement qui
   * suit une bascule, puis remise à vide.
   */
  private readonly _switchAnnouncement = signal('');
  readonly switchAnnouncement = this._switchAnnouncement.asReadonly();

  constructor() {
    // Au PREMIER rendu navigateur après un rechargement de bascule : relire le
    // marqueur (posé avant le reload), annoncer la confirmation dans la NOUVELLE
    // locale, puis nettoyer. afterNextRender ne s'exécute jamais côté SSR, donc
    // aucun accès à sessionStorage/window au niveau module (sûr pour le SSR).
    afterNextRender(() => this.announcePendingSwitch());
  }

  /**
   * Bascule vers `lang` en rechargeant l'équivalent du chemin courant dans
   * l'autre locale (le chemin, la query et le fragment sont conservés). No-op
   * côté serveur (SSR) ou si on est déjà sur la langue demandée. Pose au passage
   * un marqueur sessionStorage pour annoncer la confirmation après rechargement.
   */
  switchTo(lang: AppLocale): void {
    // Build mono-locale (dev) : aucune cible localisée à servir → no-op. On ne
    // touche PAS `location.href` (sinon repli SPA = redirection vers l'accueil fr).
    if (!this.localized()) return;
    if (!isPlatformBrowser(this.platform) || lang === this.current()) return;
    try {
      this.document.defaultView!.sessionStorage.setItem(PENDING_SWITCH_KEY, lang);
    } catch {
      // sessionStorage indisponible (mode privé, quota) → on bascule quand même,
      // sans la confirmation : la bascule reste prioritaire sur l'annonce.
    }
    this.document.defaultView!.location.href = localizedHref(
      this.document.defaultView!.location,
      lang,
    );
  }

  /** Relit et consomme le marqueur de bascule pour annoncer la confirmation (H1). */
  private announcePendingSwitch(): void {
    const win = this.document.defaultView;
    if (!win) return;

    let pending: string | null = null;
    try {
      pending = win.sessionStorage.getItem(PENDING_SWITCH_KEY);
      if (pending) win.sessionStorage.removeItem(PENDING_SWITCH_KEY);
    } catch {
      return;
    }

    // N'annoncer que si la page sert effectivement la langue demandée (la
    // bascule a réussi) — sinon un marqueur résiduel donnerait une fausse annonce.
    if (pending !== 'fr' && pending !== 'en') return;
    if (pending !== this.current()) return;

    const label = LOCALE_LABELS[pending];
    // Le texte est rendu dans la NOUVELLE locale (le build localisé est déjà
    // chargé) : $localize résout vers la bonne traduction, le libellé reste natif.
    this._switchAnnouncement.set(
      $localize`:@@locale.switched:Langue changée : ${label}:label:`,
    );
  }

  private detect(): AppLocale {
    if (!isPlatformBrowser(this.platform)) return 'fr';
    return this.document.defaultView!.location.pathname.startsWith('/en') ? 'en' : 'fr';
  }
}
