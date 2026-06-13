import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ShelterSuggestionDto } from '../models/shelter-suggestion.model';

/**
 * Suggestion d'abris adaptés à un gabarit de stationnement (Epic D, D3 → endpoint D2).
 *
 * Appelle l'endpoint public `GET /products/suggest-shelters` avec la largeur et la longueur
 * requises (cm). Le serveur exige deux entiers `1..2000` (sinon 422) : l'appelant DOIT borner
 * et arrondir AVANT d'appeler (voir `footprint.util`). Singleton applicatif.
 */
@Injectable({ providedIn: 'root' })
export class ShelterSuggestionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /**
   * Récupère les abris dont l'emprise couvre le gabarit requis (cm).
   * Les paramètres sont supposés déjà bornés/arrondis à des entiers `1..2000`.
   */
  suggestShelters(
    requiredWidthCm: number,
    requiredLengthCm: number,
  ): Observable<ShelterSuggestionDto[]> {
    const params = new HttpParams()
      .set('requiredWidthCm', String(requiredWidthCm))
      .set('requiredLengthCm', String(requiredLengthCm));
    return this.http.get<ShelterSuggestionDto[]>(`${this.baseUrl}/products/suggest-shelters`, {
      params,
    });
  }
}
