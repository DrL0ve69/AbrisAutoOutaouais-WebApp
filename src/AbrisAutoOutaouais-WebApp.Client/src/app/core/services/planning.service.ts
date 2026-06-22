import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CustomerSearchResult,
  DayDetailDto,
  UpsertWorkHoursRequest,
} from '../models/planning.model';

/**
 * Détail d'une journée du planning (US-11.2) : RDV du jour + heures des employés, et saisie des
 * heures (Admin). Le JWT est attaché par l'intercepteur HTTP ; l'API exige « StaffOrAbove » en
 * lecture et « AdminOnly » en écriture. Singleton applicatif — providedIn: 'root'.
 */
@Injectable({ providedIn: 'root' })
export class PlanningService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /** Détail d'un jour (`YYYY-MM-DD`) : RDV + tous les employés avec leurs heures. */
  getDayDetail(date: string): Observable<DayDetailDto> {
    const params = new HttpParams().set('date', date);
    return this.http.get<DayDetailDto>(`${this.baseUrl}/planning/day`, { params });
  }

  /** Crée ou met à jour les heures d'un employé pour une date (Admin). Renvoie l'Id de la ligne. */
  upsertWorkHours(req: UpsertWorkHoursRequest): Observable<{ id: string }> {
    return this.http.put<{ id: string }>(`${this.baseUrl}/planning/work-hours`, req);
  }

  /**
   * Recherche de clients par nom ou courriel pour rattacher un RDV à un client existant (Admin,
   * US-11.2). Le serveur borne à 10 résultats et exclut les comptes express anonymes.
   */
  searchCustomers(term: string): Observable<CustomerSearchResult[]> {
    const params = new HttpParams().set('term', term);
    return this.http.get<CustomerSearchResult[]>(`${this.baseUrl}/planning/customers`, { params });
  }
}
