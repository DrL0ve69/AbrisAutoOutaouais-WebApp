import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ShelterSuggestionService } from './shelter-suggestion.service';
import { environment } from '../../../environments/environment';

describe('ShelterSuggestionService', () => {
  let service: ShelterSuggestionService;
  let httpMock: HttpTestingController;
  const base = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ShelterSuggestionService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ShelterSuggestionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('appelle GET /products/suggest-shelters avec largeur/longueur requises', () => {
    service.suggestShelters(610, 720).subscribe();
    const req = httpMock.expectOne(r => r.url === `${base}/products/suggest-shelters`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('requiredWidthCm')).toBe('610');
    expect(req.request.params.get('requiredLengthCm')).toBe('720');
    req.flush([]);
  });

  it('retourne la liste d’abris telle quelle (drapeau isTightFit lu du serveur)', () => {
    const payload = [
      {
        id: 'a1',
        name: 'Abri double',
        slug: 'abri-double',
        price: 899.99,
        rentalPrice: 79.99,
        categoryName: 'Abris doubles',
        imageUrl: null,
        widthCm: 620,
        lengthCm: 730,
        heightCm: 250,
        widthMarginCm: 10,
        lengthMarginCm: 10,
        isTightFit: true,
      },
    ];
    let received: typeof payload | undefined;
    service.suggestShelters(610, 720).subscribe(r => (received = r as typeof payload));
    const req = httpMock.expectOne(r => r.url === `${base}/products/suggest-shelters`);
    req.flush(payload);
    expect(received).toEqual(payload);
    expect(received?.[0].isTightFit).toBe(true);
  });
});
