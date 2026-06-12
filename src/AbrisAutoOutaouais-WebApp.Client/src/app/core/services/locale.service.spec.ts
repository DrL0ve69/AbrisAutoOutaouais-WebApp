import { describe, it, expect } from 'vitest';
import { localizedHref } from './locale.service';

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
