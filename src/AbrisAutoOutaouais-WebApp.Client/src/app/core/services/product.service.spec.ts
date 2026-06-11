import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProductService } from './product.service';
import { environment } from '../../../environments/environment';

describe('ProductService', () => {
  let service: ProductService;
  let httpMock: HttpTestingController;
  const base = environment.apiUrl;

  const emptyPage = {
    items: [],
    totalCount: 0,
    pageNumber: 1,
    pageSize: 12,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProductService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProductService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getCategories appelle GET /categories', () => {
    service.getCategories().subscribe();
    const req = httpMock.expectOne(`${base}/categories`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getProducts utilise page=1 / pageSize=12 par défaut, sans catégorie', () => {
    service.getProducts().subscribe();
    const req = httpMock.expectOne(r => r.url === `${base}/products`);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('12');
    expect(req.request.params.has('category')).toBe(false);
    req.flush(emptyPage);
  });

  it('getProducts transmet la catégorie et la pagination fournies', () => {
    service
      .getProducts({ category: 'abris-simples', page: 2, pageSize: 5 })
      .subscribe();
    const req = httpMock.expectOne(r => r.url === `${base}/products`);
    expect(req.request.params.get('category')).toBe('abris-simples');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('5');
    req.flush(emptyPage);
  });
});
