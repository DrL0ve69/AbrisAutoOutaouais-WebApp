import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';
import { ProfileComponent } from './profile';

/**
 * Régression du bug « le profil ne sauvegarde pas ».
 * Cause : le validateur du code postal exigeait 6 caractères SANS espace, alors que
 * l'indice du champ affiche « A1A 1A1 » (avec espace). Saisir le code comme indiqué
 * invalidait le formulaire → `saveAddress()` sortait sans rien envoyer. (Leçon L-001.)
 */
describe('ProfileComponent — code postal', () => {
  // Le formulaire est créé dès la construction (initialisation de champ), donc inutile
  // de déclencher ngOnInit / un appel HTTP pour tester sa validation.
  type Control = { setValue(v: string): void; valid: boolean };
  type Internals = {
    addressForm: { controls: { postalCode: Control; civicNumber: Control } };
  };

  let postal: Control;
  let civic: Control;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(ProfileComponent);
    const controls = (fixture.componentInstance as unknown as Internals).addressForm.controls;
    postal = controls.postalCode;
    civic = controls.civicNumber;
  });

  it("accepte « J8X 1A1 » (format avec espace, exactement comme l'indice)", () => {
    postal.setValue('J8X 1A1');
    expect(postal.valid).toBe(true);
  });

  it('accepte « J8X1A1 » (sans espace)', () => {
    postal.setValue('J8X1A1');
    expect(postal.valid).toBe(true);
  });

  it('rejette un code manifestement invalide', () => {
    postal.setValue('12345');
    expect(postal.valid).toBe(false);
  });

  it('accepte un numéro civique valide (« 123 » et « 123A »)', () => {
    civic.setValue('123');
    expect(civic.valid).toBe(true);
    civic.setValue('123A');
    expect(civic.valid).toBe(true);
  });

  it('rejette un numéro civique non numérique', () => {
    civic.setValue('abc');
    expect(civic.valid).toBe(false);
  });
});
