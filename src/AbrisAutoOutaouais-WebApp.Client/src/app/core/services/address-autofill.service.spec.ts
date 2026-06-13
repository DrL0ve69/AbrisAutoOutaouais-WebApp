import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { FormBuilder, FormGroup } from '@angular/forms';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AddressAutofillService } from './address-autofill.service';
import { environment } from '../../../environments/environment';
import { PlaceSuggestionDto } from '../models/place.model';

const suggestion: PlaceSuggestionDto = {
  label: '123 rue des Abris, Gatineau',
  civicNumber: '123',
  street: 'rue des Abris',
  city: 'Gatineau',
  province: 'ON', // différent du défaut « QC » pour prouver le patch inconditionnel
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
    form = fb.nonNullable.group({
      civicNumber: [''],
      street: [''],
      city: [''],
      province: ['QC'], // défaut
      postalCode: [''],
    });
  });

  afterEach(() => httpMock.verify());

  it('applySuggestion patche civic/rue/ville/province INCONDITIONNELLEMENT et marque rue dirty', () => {
    service.applySuggestion(form, suggestion).subscribe();

    expect(form.controls['civicNumber'].value).toBe('123');
    expect(form.controls['street'].value).toBe('rue des Abris');
    expect(form.controls['city'].value).toBe('Gatineau');
    // Défaut « QC » remplacé par la province de la suggestion (patch inconditionnel, hors L-002).
    expect(form.controls['province'].value).toBe('ON');
    expect(form.controls['street'].dirty).toBe(true);

    httpMock.expectOne(r => r.url === `${base}/places/lookup-postal-code`).flush({
      postalCode: null,
    });
  });

  it('applySuggestion patche le code postal NORMALISÉ et émet quand le proxy le résout', () => {
    const emitted: string[] = [];
    service.applySuggestion(form, suggestion).subscribe(v => emitted.push(v));

    // Le proxy renvoie un code postal compact, minuscules → doit être normalisé « A1A 1A1 ».
    httpMock
      .expectOne(r => r.url === `${base}/places/lookup-postal-code`)
      .flush({ postalCode: 'k1a0a6' });

    expect(form.controls['postalCode'].value).toBe('K1A 0A6'); // normalizePostal appliqué (L-004)
    expect(emitted).toEqual(['K1A 0A6']); // émet une fois → le composant lève postalAutofilled
  });

  it('applySuggestion ne patche PAS le code postal et n\'émet rien si le proxy renvoie null', () => {
    const next = vi.fn();
    service.applySuggestion(form, suggestion).subscribe(next);

    httpMock
      .expectOne(r => r.url === `${base}/places/lookup-postal-code`)
      .flush({ postalCode: null });

    expect(form.controls['postalCode'].value).toBe(''); // resté vide
    expect(next).not.toHaveBeenCalled();
  });

  it('applySuggestion est silencieux sur erreur réseau (saisie manuelle possible)', () => {
    const next = vi.fn();
    const error = vi.fn();
    service.applySuggestion(form, suggestion).subscribe({ next, error });

    httpMock
      .expectOne(r => r.url === `${base}/places/lookup-postal-code`)
      .flush('boom', { status: 500, statusText: 'Server Error' });

    expect(form.controls['postalCode'].value).toBe('');
    expect(next).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled(); // catchError(EMPTY) → erreur avalée
  });

  it('syncStreet écrit la valeur dans « rue » et la marque dirty', () => {
    service.syncStreet(form, '45 rue Principale');

    expect(form.controls['street'].value).toBe('45 rue Principale');
    expect(form.controls['street'].dirty).toBe(true);
  });
});
