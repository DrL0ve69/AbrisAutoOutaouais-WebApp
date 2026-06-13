import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';
import { InstallationComponent } from './installation';

/**
 * Fold-in marque/modèle (Épic C) : le contrôle « brand » refuse ShelterLogic (casse + trim,
 * reflet de `Domain/Constants/ExcludedShelterBrands.cs`, leçon L-004) et accepte toute autre
 * marque ainsi que la valeur vide (champ optionnel). Le formulaire est créé à la construction,
 * donc inutile de déclencher ngOnInit / un appel HTTP pour valider ses contrôles.
 */
describe('InstallationComponent — marque/modèle', () => {
  type Control = { setValue(v: string): void; valid: boolean; hasError(code: string): boolean };
  type Internals = { form: { controls: { brand: Control; model: Control } } };

  let brand: Control;
  let model: Control;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(InstallationComponent);
    const controls = (fixture.componentInstance as unknown as Internals).form.controls;
    brand = controls.brand;
    model = controls.model;
  });

  it('rejette « ShelterLogic » (marque exclue)', () => {
    brand.setValue('ShelterLogic');
    expect(brand.valid).toBe(false);
    expect(brand.hasError('excludedBrand')).toBe(true);
  });

  it('rejette « shelterlogic » et «  ShelterLogic  » (casse + espaces)', () => {
    brand.setValue('shelterlogic');
    expect(brand.valid).toBe(false);
    brand.setValue('  ShelterLogic  ');
    expect(brand.valid).toBe(false);
  });

  it('accepte une autre marque (« Abri Plus »)', () => {
    brand.setValue('Abri Plus');
    expect(brand.valid).toBe(true);
  });

  it('accepte une marque vide (champ optionnel)', () => {
    brand.setValue('');
    expect(brand.valid).toBe(true);
  });

  it('accepte un modèle libre', () => {
    model.setValue('Garage 12x20');
    expect(model.valid).toBe(true);
  });
});
