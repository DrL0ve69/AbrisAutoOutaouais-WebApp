import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Component, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { render, screen, waitFor } from '@testing-library/angular';
import { TestBed } from '@angular/core/testing';
import { LocaleService, localizedHref } from './locale.service';
import { environment } from '../../../environments/environment';

/**
 * Bascule de langue (i18n compile-time) : passer à l'autre locale doit conserver
 * le chemin, la query et le fragment — pas seulement renvoyer à l'accueil.
 */
describe('localizedHref', () => {
  const loc = (pathname: string, search = '', hash = '') => ({ pathname, search, hash });

  it("préfixe « /en » au chemin courant en passant à l'anglais", () => {
    expect(localizedHref(loc('/boutique'), 'en')).toBe('/en/boutique');
  });

  it("mappe l'accueil français « / » vers « /en/ »", () => {
    expect(localizedHref(loc('/'), 'en')).toBe('/en/');
  });

  it('retire le préfixe « /en » en revenant au français', () => {
    expect(localizedHref(loc('/en/panier'), 'fr')).toBe('/panier');
  });

  it("mappe l'accueil anglais « /en/ » vers « / »", () => {
    expect(localizedHref(loc('/en/'), 'fr')).toBe('/');
  });

  it('préserve la query string et le fragment', () => {
    expect(localizedHref(loc('/boutique', '?tri=prix', '#liste'), 'en')).toBe(
      '/en/boutique?tri=prix#liste',
    );
  });

  it('ne confond pas un chemin « /enfants » avec le préfixe de locale', () => {
    // « /enfants » ne doit PAS être traité comme « /en » + « fants ».
    expect(localizedHref(loc('/enfants'), 'en')).toBe('/en/enfants');
    expect(localizedHref(loc('/enfants'), 'fr')).toBe('/enfants');
  });
});

/**
 * Drapeau mono-locale vs bi-locale (Épic C). En dev (`ng serve`, environnement de
 * test = `environment.ts`), `localized` vaut `false` : la bascule de langue est un
 * no-op et le bouton est dégradé. En prod/staging (`environment.localized = true`),
 * le comportement est inchangé. On teste les DEUX branches en pilotant le flag via
 * `vi.spyOn(environment, 'localized', 'get')` pour que les assertions ne soient pas
 * vacueuses (L-009 : on prouve l'effet dans chaque état, pas seulement le défaut).
 */
describe('LocaleService — drapeau localized + switchTo no-op (Épic C)', () => {
  /**
   * Document factice : `location` est un objet nu, donc affecter `location.href`
   * NE navigue PAS la page de test (impératif en mode browser) et reste OBSERVABLE.
   * `pathname` « / » → current() = « fr ». `sessionStorage` réel (jsdom/browser).
   */
  const stubDocument = (location: { pathname: string; search: string; hash: string; href: string }) =>
    ({
      defaultView: { location, sessionStorage: window.sessionStorage },
    }) as unknown as Document;

  const makeService = (location: { pathname: string; search: string; hash: string; href: string }) => {
    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: stubDocument(location) }],
    });
    return TestBed.inject(LocaleService);
  };

  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.removeItem('locale-switch-pending');
    TestBed.resetTestingModule();
  });

  it('localized() reflète environment.localized (faux en dev/test)', () => {
    // L'environnement de test est `environment.ts` → localized = false.
    expect(environment.localized).toBe(false);
    const location = { pathname: '/', search: '', hash: '', href: 'http://localhost/' };
    const service = makeService(location);
    expect(service.localized()).toBe(false);
  });

  it('switchTo() est un NO-OP en mono-locale : ne touche PAS location.href', () => {
    const location = { pathname: '/', search: '', hash: '', href: 'http://localhost/' };
    const service = makeService(location);
    expect(service.localized()).toBe(false);

    service.switchTo('en');

    // Le garde mono-locale sort AVANT toute écriture : href intact, pas de marqueur.
    expect(location.href).toBe('http://localhost/');
    expect(sessionStorage.getItem('locale-switch-pending')).toBeNull();
  });

  it('en bi-locale, localized() est vrai et switchTo() redirige vers /en/…', () => {
    // On force le flag à true pour prouver que la branche active fonctionne (sinon
    // le test « no-op » ci-dessus pourrait passer pour une mauvaise raison — L-009).
    vi.spyOn(environment, 'localized', 'get').mockReturnValue(true);
    const location = {
      pathname: '/boutique',
      search: '',
      hash: '',
      href: 'http://localhost/boutique',
    };
    const service = makeService(location);
    expect(service.localized()).toBe(true);
    expect(service.current()).toBe('fr');

    service.switchTo('en');

    // Branche active : marqueur posé + redirection vers l'équivalent localisé.
    expect(sessionStorage.getItem('locale-switch-pending')).toBe('en');
    expect(location.href).toBe('/en/boutique');
  });
});

/**
 * Confirmation de changement de langue (H1). Le switch recharge la page (i18n
 * compile-time) : un marqueur sessionStorage est posé AVANT le reload, relu au
 * chargement suivant pour annoncer la confirmation, puis nettoyé. On simule le
 * « chargement suivant » en pré-remplissant sessionStorage avant de rendre un
 * hôte qui injecte le service (déclenche son afterNextRender).
 */
const PENDING_KEY = 'locale-switch-pending';

@Component({ template: `{{ locale.switchAnnouncement() }}` })
class HostComponent {
  protected readonly locale = inject(LocaleService);
}

describe('LocaleService — confirmation de bascule (H1)', () => {
  beforeEach(() => sessionStorage.removeItem(PENDING_KEY));
  afterEach(() => sessionStorage.removeItem(PENDING_KEY));

  it('annonce la confirmation au chargement quand le marqueur correspond à la locale servie', async () => {
    // Le runner sert «/» → current() vaut « fr ». On pose le marqueur « fr ».
    sessionStorage.setItem(PENDING_KEY, 'fr');

    const { container } = await render(HostComponent);

    await waitFor(() =>
      expect(container.textContent).toMatch(/langue changée\s*:\s*français/i),
    );
    // Le marqueur est consommé (nettoyé) après l'annonce.
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it('n’annonce RIEN sans marqueur (cas normal de navigation)', async () => {
    const { container } = await render(HostComponent);

    // Laisse passer les hooks de rendu : aucun texte d'annonce ne doit apparaître.
    await new Promise(r => setTimeout(r, 50));
    expect(container.textContent?.trim()).toBe('');
  });

  it('n’annonce PAS quand le marqueur vise une AUTRE locale que celle servie', async () => {
    // Marqueur « en » alors que le runner sert « fr » → bascule non aboutie,
    // pas de fausse annonce. Le marqueur est tout de même consommé.
    sessionStorage.setItem(PENDING_KEY, 'en');

    const { container } = await render(HostComponent);

    await new Promise(r => setTimeout(r, 50));
    expect(container.textContent?.trim()).toBe('');
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
  });
});
