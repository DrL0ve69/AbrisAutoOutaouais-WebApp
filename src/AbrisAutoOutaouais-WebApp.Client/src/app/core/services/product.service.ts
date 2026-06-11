import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CategoryDto,
  PaginatedList,
  ProductDto,
  ProductQuery,
} from '../models/product.model';

/**
 * Accès au catalogue (produits + catégories) exposé par l'API.
 * Singleton applicatif — providedIn: 'root'.
 */
@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getCategories(): Observable<CategoryDto[]> {
    return this.http.get<CategoryDto[]>(`${this.baseUrl}/categories`);
  }

  getProducts(query: ProductQuery = {}): Observable<PaginatedList<ProductDto>> {
    let params = new HttpParams()
      .set('page', String(query.page ?? 1))
      .set('pageSize', String(query.pageSize ?? 12));

    if (query.category) {
      params = params.set('category', query.category);
    }
    if (query.search) {
      params = params.set('search', query.search);
    }

    return this.http.get<PaginatedList<ProductDto>>(`${this.baseUrl}/products`, {
      params,
    });
  }
}
