import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { FormBuilder } from '@angular/forms';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProfileService } from './profile.service';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
import { UserProfileDto } from '../models/profile.model';

const profileWithAddress: UserProfileDto = {
  id: '1',
  email: 'a@b.com',
  username: 'ab',
  firstName: 'A',
  lastName: 'B',
  phoneNumber: null,
  avatar: null,
  preferredLanguage: 'fr',
  defaultDeliveryAddress: {
    civicNumber: '1',
    street: 'rue des Abris',
    apartment: null,
    city: 'Gatineau',
    province: 'QC',
    postalCode: 'J8X 1A1',
    country: 'Canada',
  },
  createdAt: '2026-01-01T00:00:00Z',
  roles: ['Customer'],
};

describe('ProfileService', () => {
  let service: ProfileService;
  let httpMock: HttpTestingController;
  const base = environment.apiUrl;
  let authed = true;

  beforeEach(() => {
    authed = true;
    TestBed.configureTestingModule({
      providers: [
        ProfileService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { isAuthenticated: () => authed } },
      ],
    });
    service = TestBed.inject(ProfileService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it("ensureLoaded charge GET /auth/me une seule fois et met l'adresse en cache", () => {
    service.ensureLoaded();
    const req = httpMock.expectOne(`${base}/auth/me`);
    expect(req.request.method).toBe('GET');
    req.flush(profileWithAddress);

    expect(service.defaultDeliveryAddress()?.postalCode).toBe('J8X 1A1');

    // Deuxième appel : aucune nouvelle requête (déjà chargé).
    service.ensureLoaded();
    httpMock.expectNone(`${base}/auth/me`);
  });

  it('ensureLoaded ne fait rien si non authentifié', () => {
    authed = false;
    service.ensureLoaded();
    httpMock.expectNone(`${base}/auth/me`);
  });

  it("applyDefaultAddress remplit les champs intacts (pristine) sans écraser une saisie", () => {
    const fb = TestBed.inject(FormBuilder);
    const form = fb.nonNullable.group({
      civicNumber: [''],
      street: [''],
      apartment: [''],
      city: ['Hull'], // l'utilisateur a saisi « Hull » (marqué dirty ci-dessous)
      province: ['QC'], // valeur PAR DÉFAUT, pristine → doit être remplacée par l'adresse
      postalCode: [''],
      country: ['Canada'],
    });
    form.controls.city.markAsDirty(); // simule une saisie utilisateur sur « ville »

    service.applyDefaultAddress(form, {
      civicNumber: '1',
      street: 'rue des Abris',
      apartment: '4B',
      city: 'Gatineau',
      province: 'ON', // différent du défaut « QC »
      postalCode: 'K1A 0A6',
      country: 'Canada',
    });

    expect(form.controls.civicNumber.value).toBe('1'); // vide + pristine → rempli
    expect(form.controls.street.value).toBe('rue des Abris'); // vide + pristine → rempli
    expect(form.controls.apartment.value).toBe('4B'); // vide + pristine → rempli
    expect(form.controls.postalCode.value).toBe('K1A 0A6'); // vide + pristine → rempli
    expect(form.controls.province.value).toBe('ON'); // défaut pristine → remplacé
    expect(form.controls.city.value).toBe('Hull'); // édité (dirty) → préservé
  });
});
