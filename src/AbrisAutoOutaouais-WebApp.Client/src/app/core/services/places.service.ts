import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
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

  /**
   * Géocode une adresse civique complète en réutilisant `suggest` (pas d'endpoint dédié) et en
   * prenant la 1re entrée — qui porte `lat`/`lng` (Photon). Renvoie `null` si aucune suggestion.
   *
   * Sert à centrer la carte de mesure (D4) lorsqu'une adresse a été saisie/préremplie SANS choisir
   * de suggestion (donc sans lat/lng) : l'appelant géocode juste avant de passer à l'étape carte.
   */
  geocode(
    civicNumber: string,
    street: string,
    city: string,
    province: string,
  ): Observable<PlaceSuggestionDto | null> {
    const query = [civicNumber, street, city, province].filter((p) => p?.trim()).join(' ');
    return this.suggest(query, city, province).pipe(
      map((suggestions) => suggestions[0] ?? null),
    );
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
