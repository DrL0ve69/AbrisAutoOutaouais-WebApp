import { describe, it, expect } from 'vitest';
import { normalizePostal, parseCivicFromLabel, splitAddressLine } from './address.validators';

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

describe('splitAddressLine', () => {
  it('scinde « 45 rue X » en { civicNumber: 45, street: rue X }', () => {
    expect(splitAddressLine('45 rue X')).toEqual({ civicNumber: '45', street: 'rue X' });
  });

  it('conserve la lettre finale du civique (« 123A boul Y »)', () => {
    expect(splitAddressLine('123A boul Y')).toEqual({ civicNumber: '123A', street: 'boul Y' });
  });

  it('sans numéro en tête : civique vide, toute la ligne devient la rue (frappe libre)', () => {
    expect(splitAddressLine('rue Z')).toEqual({ civicNumber: '', street: 'rue Z' });
  });

  it('ligne vide → civique et rue vides', () => {
    expect(splitAddressLine('')).toEqual({ civicNumber: '', street: '' });
  });

  it('tolère les espaces superflus autour de la ligne', () => {
    expect(splitAddressLine('  77  rue Principale  ')).toEqual({
      civicNumber: '77',
      street: 'rue Principale',
    });
  });

  it('ne capture QUE le civique de tête quand le nom de rue contient un chiffre (« 45 rue 8e Avenue »)', () => {
    expect(splitAddressLine('45 rue 8e Avenue')).toEqual({
      civicNumber: '45',
      street: 'rue 8e Avenue',
    });
  });
});
