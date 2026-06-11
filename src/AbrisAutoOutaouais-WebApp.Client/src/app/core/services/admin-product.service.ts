import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateProductRequest, UpdateProductRequest } from '../models/product.model';

/**
 * Opérations d'administration du catalogue (création, mise à jour, suppression).
 * Réservé aux administrateurs — le JWT est attaché par l'intercepteur HTTP existant
 * et l'API exige la politique « AdminOnly ».
 * Singleton applicatif — providedIn: 'root'.
 */
@Injectable({ providedIn: 'root' })
export class AdminProductService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /** Crée un produit ; retourne son identifiant. */
  createProduct(request: CreateProductRequest): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.baseUrl}/products`, request);
  }

  /** Met à jour un produit existant (204 No Content). */
  updateProduct(id: string, request: UpdateProductRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/products/${id}`, request);
  }

  /** Supprime un produit — soft delete côté API (204 No Content). */
  deleteProduct(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/products/${id}`);
  }
}
