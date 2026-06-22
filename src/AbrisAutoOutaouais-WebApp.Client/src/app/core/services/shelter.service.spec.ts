import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ShelterService } from './shelter.service';
import { environment } from '../../../environments/environment';

describe('ShelterService', () => {
  let service: ShelterService;
  let httpMock: HttpTestingController;
  const base = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ShelterService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ShelterService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getModels() sans filtre : GET /shelters sans paramètre category', () => {
    service.getModels().subscribe();
    const req = httpMock.expectOne(r => r.url === `${base}/shelters`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('category')).toBe(false);
    req.flush([]);
  });

  it('getModels(slug) : GET /shelters?category={slug}', () => {
    service.getModels('abris-simples').subscribe();
    const req = httpMock.expectOne(r => r.url === `${base}/shelters`);
    expect(req.request.params.get('category')).toBe('abris-simples');
    req.flush([]);
  });

  it('getModel(slug) : GET /shelters/{slug}', () => {
    service.getModel('simple').subscribe();
    const req = httpMock.expectOne(`${base}/shelters/simple`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('getModel(slug) inconnu : propage le 404', () => {
    let status: number | undefined;
    service.getModel('inconnu').subscribe({ error: e => (status = e.status) });
    httpMock
      .expectOne(`${base}/shelters/inconnu`)
      .flush('Not found', { status: 404, statusText: 'Not Found' });
    expect(status).toBe(404);
  });

  it('getPrice(slug, lengthCm, clearHeightCm) : GET /shelters/{slug}/price?lengthCm={n}&clearHeightCm={h}', () => {
    service.getPrice('simple', 366, 198).subscribe();
    const req = httpMock.expectOne(r => r.url === `${base}/shelters/simple/price`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('lengthCm')).toBe('366');
    // La hauteur dégagée fait désormais partie de la requête (le prix dépend de la grille).
    expect(req.request.params.get('clearHeightCm')).toBe('198');
    req.flush({ modelId: 'm1', slug: 'simple', lengthCm: 366, clearHeightCm: 198, totalPrice: 549 });
  });

  it('getPrice() combinaison absente de la grille : propage le 422', () => {
    let status: number | undefined;
    service.getPrice('simple', 200, 259).subscribe({ error: e => (status = e.status) });
    httpMock
      .expectOne(r => r.url === `${base}/shelters/simple/price`)
      .flush('Unprocessable', { status: 422, statusText: 'Unprocessable Entity' });
    expect(status).toBe(422);
  });
});
