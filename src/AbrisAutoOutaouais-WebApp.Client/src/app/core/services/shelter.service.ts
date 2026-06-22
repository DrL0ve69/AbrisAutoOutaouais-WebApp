import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ShelterModelDetail,
  ShelterModelSummary,
  ShelterPrice,
} from '../models/shelter.model';

/**
 * Accès au catalogue PARAMÉTRIQUE d'abris (EPIC 9.2). Trois endpoints publics, lecture seule,
 * sous `${apiUrl}/shelters` (`environment.apiUrl` vaut déjà `…/api/v1`). Singleton applicatif —
 * calque `ShelterSuggestionService` (HttpClient injecté, base d'URL depuis l'environnement).
 *
 * Le prix affiché final provient TOUJOURS de `getPrice` (source unique — L-004) ; un calcul
 * optimiste local éventuel doit reproduire `ShelterPriceCalculator.cs`, jamais le remplacer.
 */
@Injectable({ providedIn: 'root' })
export class ShelterService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /** Liste les modèles paramétriques, optionnellement filtrés par slug de catégorie. */
  getModels(categorySlug?: string): Observable<ShelterModelSummary[]> {
    let params = new HttpParams();
    if (categorySlug) {
      params = params.set('category', categorySlug);
    }
    return this.http.get<ShelterModelSummary[]>(`${this.baseUrl}/shelters`, { params });
  }

  /** Détail d'un modèle par slug (options largeur/hauteur incluses) ; 404 si inconnu. */
  getModel(slug: string): Observable<ShelterModelDetail> {
    return this.http.get<ShelterModelDetail>(
      `${this.baseUrl}/shelters/${encodeURIComponent(slug)}`,
    );
  }

  /**
   * Calcule le prix serveur d'un modèle pour un couple (longueur, hauteur dégagée) configuré
   * (cm entiers). Le prix dépend de la GRILLE (modèle × longueur × hauteur).
   * 404 si slug inconnu ; 422 si la combinaison n'existe pas dans la grille (couple non offert).
   */
  getPrice(slug: string, lengthCm: number, clearHeightCm: number): Observable<ShelterPrice> {
    const params = new HttpParams()
      .set('lengthCm', String(lengthCm))
      .set('clearHeightCm', String(clearHeightCm));
    return this.http.get<ShelterPrice>(
      `${this.baseUrl}/shelters/${encodeURIComponent(slug)}/price`,
      { params },
    );
  }
}
