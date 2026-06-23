import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { FormBuilder, FormGroup } from '@angular/forms';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AddressAutofillService, PostalFillResult } from './address-autofill.service';
import { environment } from '../../../environments/environment';
import { PlaceSuggestionDto } from '../models/place.model';

// Forme du provider PAR DÉFAUT (Photon) : `civicNumber` null + numéro inclus dans le `label`
// (L-011) — c'est cette forme que la cascade doit savoir scinder pour recombiner `addressLine1`,
// pas une forme déjà découpée qui masquerait le trou. La province reste en code 2 lettres canonique
// (« ON ») : l'adaptateur serveur l'émet déjà ainsi (L-004/L-011), l'autofill la patche verbatim.
const suggestion: PlaceSuggestionDto = {
  label: '123 rue des Abris, Gatineau',
  civicNumber: null,
  street: 'rue des Abris',
  city: 'Gatineau',
  province: 'ON', // différent du défaut « QC » pour prouver le patch inconditionnel (D3)
  postalCode: null,
  lat: null,
  lng: null,
};

describe('AddressAutofillService', () => {
  let service: AddressAutofillService;
  let httpMock: HttpTestingController;
  let form: FormGroup;
  const base = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AddressAutofillService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AddressAutofillService);
    httpMock = TestBed.inject(HttpTestingController);

    const fb = TestBed.inject(FormBuilder);
    // EPIC 15 — champ unifié `addressLine1` (n° + rue), plus de `civicNumber`/`street` séparés.
    form = fb.nonNullable.group({
      addressLine1: [''],
      city: [''],
      province: ['QC'], // défaut
      postalCode: [''],
    });
  });

  afterEach(() => httpMock.verify());

  it('applySuggestion recombine n°+rue dans addressLine1, patche ville/province et marque la ligne dirty', () => {
    service.applySuggestion(form, suggestion).subscribe();

    // Le numéro est parsé du libellé Photon (civicNumber null) puis recombiné avec la rue.
    expect(form.controls['addressLine1'].value).toBe('123 rue des Abris');
    expect(form.controls['city'].value).toBe('Gatineau');
    // Défaut « QC » remplacé par la province de la suggestion (patch inconditionnel, hors L-002).
    expect(form.controls['province'].value).toBe('ON');
    expect(form.controls['addressLine1'].dirty).toBe(true);

    httpMock.expectOne(r => r.url === `${base}/places/lookup-postal-code`).flush({
      postalCode: null,
    });
  });

  // D3 — cas sans province : la cascade retombe sur « QC » (le serveur émet déjà le code 2 lettres
  // canonique, aucune whitelist client — L-004/L-011).
  it('applySuggestion retombe sur « QC » quand la suggestion ne porte pas de province', () => {
    service.applySuggestion(form, { ...suggestion, province: '' }).subscribe();

    expect(form.controls['province'].value).toBe('QC');

    httpMock
      .expectOne(r => r.url === `${base}/places/lookup-postal-code`)
      .flush({ postalCode: null });
  });

  // D1 — le civique déjà présent dans la ligne unifiée ne doit JAMAIS être perdu quand la suggestion
  // n'a pas de numéro et que le libellé n'en porte pas non plus : il est ré-extrait via splitAddressLine.
  it('applySuggestion préserve le civique de la ligne saisie quand la suggestion et le libellé n\'en ont pas', () => {
    form.controls['addressLine1'].setValue('77 rue des Abris');
    const sansCivic: PlaceSuggestionDto = {
      ...suggestion,
      civicNumber: null,
      label: 'rue des Abris, Gatineau', // pas de numéro en tête
    };

    service.applySuggestion(form, sansCivic).subscribe();

    // « 77 » ré-extrait de la ligne existante, recombiné avec la rue de la suggestion.
    expect(form.controls['addressLine1'].value).toBe('77 rue des Abris');

    httpMock
      .expectOne(r => r.url === `${base}/places/lookup-postal-code`)
      .flush({ postalCode: null });
  });

  // D1 — quand la suggestion n'a pas de `civicNumber` mais que le libellé commence par un numéro,
  // on parse le numéro depuis le libellé (forme Photon par défaut).
  it('applySuggestion parse le numéro civique depuis le libellé quand civicNumber est null', () => {
    const sansCivic: PlaceSuggestionDto = {
      ...suggestion,
      civicNumber: null,
      street: 'boul. Saint-Joseph',
      label: '456 boul. Saint-Joseph, Gatineau',
    };

    service.applySuggestion(form, sansCivic).subscribe();

    expect(form.controls['addressLine1'].value).toBe('456 boul. Saint-Joseph');

    httpMock
      .expectOne(r => r.url === `${base}/places/lookup-postal-code`)
      .flush({ postalCode: null });
  });

  it('applySuggestion patche le code postal NORMALISÉ et émet « filled » quand le proxy le résout', () => {
    const emitted: PostalFillResult[] = [];
    service.applySuggestion(form, suggestion).subscribe(v => emitted.push(v));

    // Le proxy renvoie un code postal compact, minuscules → doit être normalisé « A1A 1A1 ».
    httpMock
      .expectOne(r => r.url === `${base}/places/lookup-postal-code`)
      .flush({ postalCode: 'k1a0a6' });

    expect(form.controls['postalCode'].value).toBe('K1A 0A6'); // normalizePostal appliqué (L-004)
    expect(emitted).toEqual([{ status: 'filled', postalCode: 'K1A 0A6' }]);
  });

  // D2 — la suggestion porte déjà un code postal : aucun appel réseau, émission « filled » directe.
  it('applySuggestion normalise le code postal de la suggestion SANS appel HTTP s\'il est déjà fourni', () => {
    const emitted: PostalFillResult[] = [];
    service
      .applySuggestion(form, { ...suggestion, postalCode: 'j8x1a1' })
      .subscribe(v => emitted.push(v));

    expect(form.controls['postalCode'].value).toBe('J8X 1A1');
    expect(emitted).toEqual([{ status: 'filled', postalCode: 'J8X 1A1' }]);
    // Aucune requête de lookup ne doit avoir été émise.
    httpMock.expectNone(r => r.url === `${base}/places/lookup-postal-code`);
  });

  // D2 — lookup null → « unavailable » (plus de silence : le composant invite à la saisie manuelle).
  it('applySuggestion ne patche PAS le code postal et émet « unavailable » si le proxy renvoie null', () => {
    const emitted: PostalFillResult[] = [];
    service.applySuggestion(form, suggestion).subscribe(v => emitted.push(v));

    httpMock
      .expectOne(r => r.url === `${base}/places/lookup-postal-code`)
      .flush({ postalCode: null });

    expect(form.controls['postalCode'].value).toBe(''); // resté vide
    expect(emitted).toEqual([{ status: 'unavailable' }]);
  });

  // D2 — erreur réseau → « unavailable » (l'erreur est mappée, plus avalée en EMPTY).
  it('applySuggestion émet « unavailable » sur erreur réseau (saisie manuelle possible)', () => {
    const emitted: PostalFillResult[] = [];
    const error = vi.fn();
    service.applySuggestion(form, suggestion).subscribe({ next: v => emitted.push(v), error });

    httpMock
      .expectOne(r => r.url === `${base}/places/lookup-postal-code`)
      .flush('boom', { status: 500, statusText: 'Server Error' });

    expect(form.controls['postalCode'].value).toBe('');
    expect(emitted).toEqual([{ status: 'unavailable' }]);
    expect(error).not.toHaveBeenCalled(); // catchError → unavailable, pas d'erreur propagée
  });

  it('syncAddressLine écrit la valeur dans addressLine1 et la marque dirty', () => {
    service.syncAddressLine(form, '45 rue Principale');

    expect(form.controls['addressLine1'].value).toBe('45 rue Principale');
    expect(form.controls['addressLine1'].dirty).toBe(true);
  });
});
