import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ShelterFitResult } from '../models/shelter-fit.model';

/**
 * Suggestion de MODÈLES d'abris paramétriques adaptés à un gabarit de stationnement
 * (EPIC 10, US-10.1 → endpoint `GET /shelters/suggest`).
 *
 * Le serveur exige deux entiers `1..2000` (sinon 422) : l'appelant DOIT borner et arrondir AVANT
 * d'appeler (voir `footprint.util`). Les résultats sont déjà groupés par catégorie et leurs
 * longueurs admissibles bornées côté serveur. Singleton applicatif.
 */
@Injectable({ providedIn: 'root' })
export class ShelterSuggestionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /**
   * Récupère les modèles d'abris compatibles avec le gabarit requis (cm), groupés par catégorie.
   * Les paramètres sont supposés déjà bornés/arrondis à des entiers `1..2000`.
   */
  suggestModels(
    requiredWidthCm: number,
    requiredLengthCm: number,
  ): Observable<ShelterFitResult[]> {
    const params = new HttpParams()
      .set('requiredWidthCm', String(requiredWidthCm))
      .set('requiredLengthCm', String(requiredLengthCm));
    return this.http.get<ShelterFitResult[]>(`${this.baseUrl}/shelters/suggest`, { params });
  }
}
