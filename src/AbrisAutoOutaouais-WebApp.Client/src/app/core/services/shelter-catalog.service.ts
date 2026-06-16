import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BrandCatalog } from '../models/shelter-catalog.model';

/**
 * Catalogue marque → modèles → dimensions (Épic G, G2 — endpoint public
 * `GET /products/shelter-catalog`). Alimente les listes déroulantes du formulaire
 * d'installation. Singleton applicatif.
 */
@Injectable({ providedIn: 'root' })
export class ShelterCatalogService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /** Récupère le catalogue des marques disponibles avec leurs modèles. */
  getCatalog(): Observable<BrandCatalog[]> {
    return this.http.get<BrandCatalog[]>(`${this.baseUrl}/products/shelter-catalog`);
  }
}
