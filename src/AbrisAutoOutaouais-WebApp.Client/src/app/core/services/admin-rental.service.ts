import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminRentalDto } from '../models/rental.model';

/**
 * Opérations d'administration des locations (consultation et annulation).
 * Réservé aux administrateurs — le JWT est attaché par l'intercepteur HTTP existant
 * et l'API exige la politique « AdminOnly ». La route « admin-cancel » est distincte
 * de l'annulation client (POST /rentals/{id}/cancel, réservée au propriétaire).
 * Singleton applicatif — providedIn: 'root'.
 */
@Injectable({ providedIn: 'root' })
export class AdminRentalService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /** Tous les contrats de location, tous clients confondus. */
  getAllRentals(): Observable<AdminRentalDto[]> {
    return this.http.get<AdminRentalDto[]>(`${this.baseUrl}/rentals/all`);
  }

  /** Annule n'importe quel contrat de location (204 No Content). */
  cancel(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/rentals/${id}/admin-cancel`, null);
  }

  /**
   * Réconcilie le paiement d'un contrat de location (virement Interac reçu) → ACTIVE le contrat
   * (204 No Content). Réservé à l'administration (politique « AdminOnly » côté API) — EPIC 7.2.
   */
  confirmPayment(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/rentals/${id}/confirm-payment`, {});
  }
}
