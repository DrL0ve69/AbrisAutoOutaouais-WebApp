import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ShelterSuggestionService } from './shelter-suggestion.service';
import { ShelterFitResult } from '../models/shelter-fit.model';
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

  it('appelle GET /shelters/suggest avec largeur/longueur requises', () => {
    service.suggestModels(610, 720).subscribe();
    const req = httpMock.expectOne(r => r.url === `${base}/shelters/suggest`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('requiredWidthCm')).toBe('610');
    expect(req.request.params.get('requiredLengthCm')).toBe('720');
    req.flush([]);
  });

  it('retourne les catégories groupées telles quelles (modèles + longueurs admissibles)', () => {
    const payload: ShelterFitResult[] = [
      {
        categorySlug: 'abris-doubles',
        categoryName: 'Abris doubles',
        categoryMaxWidthCm: 488,
        models: [
          {
            id: 'a1',
            slug: 'double-pointu-16pi',
            name: 'Abri double pointu 16 pi',
            widthCm: 488,
            basePrice: 1899,
            minLengthCm: 488,
            lengthStepCm: 122,
            availableLengthsCm: [488, 610, 732],
          },
        ],
      },
    ];
    let received: ShelterFitResult[] | undefined;
    service.suggestModels(610, 720).subscribe(r => (received = r));
    const req = httpMock.expectOne(r => r.url === `${base}/shelters/suggest`);
    req.flush(payload);
    expect(received).toEqual(payload);
    expect(received?.[0].models[0].availableLengthsCm).toEqual([488, 610, 732]);
  });
});
