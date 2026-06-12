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
    street: '1 rue des Abris',
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

  it('applyDefaultAddress ne remplit que les champs vides/pristine', () => {
    const fb = TestBed.inject(FormBuilder);
    const form = fb.nonNullable.group({
      street: [''],
      city: ['Hull'], // déjà saisi par l'utilisateur
      province: ['QC'],
      postalCode: [''],
      country: ['Canada'],
    });

    service.applyDefaultAddress(form, profileWithAddress.defaultDeliveryAddress);

    expect(form.controls.street.value).toBe('1 rue des Abris'); // vide → rempli
    expect(form.controls.postalCode.value).toBe('J8X 1A1'); // vide → rempli
    expect(form.controls.city.value).toBe('Hull'); // déjà saisi → préservé
  });
});
