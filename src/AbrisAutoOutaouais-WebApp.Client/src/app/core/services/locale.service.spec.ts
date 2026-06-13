import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, inject } from '@angular/core';
import { render, screen, waitFor } from '@testing-library/angular';
import { LocaleService, localizedHref } from './locale.service';

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
