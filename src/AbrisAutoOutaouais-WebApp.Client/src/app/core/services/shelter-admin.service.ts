import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateShelterModelRequest,
  UpdateShelterModelRequest,
} from '../models/shelter.model';

/**
 * Opérations d'ADMINISTRATION du référentiel de modèles d'abris paramétriques (EPIC 9.5).
 * Réservé aux administrateurs : le JWT est attaché par l'intercepteur HTTP et l'API exige la
 * politique « AdminOnly ». Singleton applicatif — calque `AdminProductService`. NE touche PAS au
 * `ShelterService` (lecture seule du catalogue) — séparation lecture / écriture.
 */
@Injectable({ providedIn: 'root' })
export class ShelterAdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /** Crée un modèle paramétrique ; retourne son identifiant (201). */
  createModel(request: CreateShelterModelRequest): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.baseUrl}/shelters`, request);
  }

  /** Reconfigure un modèle existant — slug immuable (204 No Content). */
  updateModel(id: string, request: UpdateShelterModelRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/shelters/${id}`, request);
  }

  /** Supprime un modèle — soft delete côté API (204 No Content). */
  deleteModel(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/shelters/${id}`);
  }
}
