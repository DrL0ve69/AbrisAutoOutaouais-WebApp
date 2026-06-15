import { describe, it, expect } from 'vitest';
import { normalizePostal, parseCivicFromLabel } from './address.validators';

describe('normalizePostal', () => {
  it('normalise un code compact en majuscules « A1A 1A1 »', () => {
    expect(normalizePostal('k1a0a6')).toBe('K1A 0A6');
  });

  it('réécrit un code déjà espacé de façon canonique', () => {
    expect(normalizePostal('  j8x   1a1 ')).toBe('J8X 1A1');
  });

  it('laisse une valeur non conforme telle quelle (trim)', () => {
    expect(normalizePostal('  abc ')).toBe('abc');
  });
});

describe('parseCivicFromLabel', () => {
  it('extrait le numéro civique en tête de libellé', () => {
    expect(parseCivicFromLabel('123 rue des Abris, Gatineau')).toBe('123');
  });

  it('conserve une lettre finale optionnelle (« 123A »)', () => {
    expect(parseCivicFromLabel('123A boul. Saint-Joseph')).toBe('123A');
  });

  it('tolère des espaces de tête', () => {
    expect(parseCivicFromLabel('   45 rue Principale')).toBe('45');
  });

  it('retourne null quand le libellé ne commence pas par un numéro', () => {
    expect(parseCivicFromLabel('rue des Abris, Gatineau')).toBeNull();
  });

  it('retourne null pour un libellé vide', () => {
    expect(parseCivicFromLabel('')).toBeNull();
  });

  it('ne capture pas un numéro à deux lettres finales (hors format canonique)', () => {
    // « 12AB » n'est pas un civique canonique ; \b coupe après « 12A », mais « 12A » suivi de
    // « B » sans frontière n'est PAS un mot-frontière → aucun match en tête → null.
    expect(parseCivicFromLabel('12AB rue Test')).toBeNull();
  });
});
