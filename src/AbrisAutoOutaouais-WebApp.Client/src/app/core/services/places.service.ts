import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PlaceSuggestionDto, PostalCodeLookupDto } from '../models/place.model';

/**
 * Proxy d'adresses côté client (autocomplétion + résolution de code postal).
 * Appelle les endpoints publics du `PlacesController` (Epic C, C2). Le débit est
 * limité côté serveur (politique « places ») : on debounce la frappe dans le
 * composant combobox plutôt que d'appeler à chaque touche.
 */
@Injectable({ providedIn: 'root' })
export class PlacesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /** Autocomplétion d'adresse à partir d'un texte saisi (ville/province en indices). */
  suggest(query: string, city?: string, province?: string): Observable<PlaceSuggestionDto[]> {
    let params = new HttpParams().set('query', query);
    if (city) params = params.set('city', city);
    if (province) params = params.set('province', province);
    return this.http.get<PlaceSuggestionDto[]>(`${this.baseUrl}/places/suggest`, { params });
  }

  /** Résout le code postal d'une adresse civique complète (`postalCode` peut être `null`). */
  lookupPostalCode(
    civicNumber: string,
    street: string,
    city: string,
    province: string,
  ): Observable<PostalCodeLookupDto> {
    const params = new HttpParams()
      .set('civicNumber', civicNumber)
      .set('street', street)
      .set('city', city)
      .set('province', province);
    return this.http.get<PostalCodeLookupDto>(`${this.baseUrl}/places/lookup-postal-code`, {
      params,
    });
  }
}
