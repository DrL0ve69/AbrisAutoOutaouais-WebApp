import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminBookingDto, BookingStatusAction } from '../models/booking.model';

/**
 * Opérations d'administration des réservations (consultation et transitions de statut).
 * Réservé aux administrateurs — le JWT est attaché par l'intercepteur HTTP existant
 * et l'API exige la politique « AdminOnly ».
 * Singleton applicatif — providedIn: 'root'.
 */
@Injectable({ providedIn: 'root' })
export class AdminBookingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /** Toutes les réservations, tous clients confondus. */
  getAllBookings(): Observable<AdminBookingDto[]> {
    return this.http.get<AdminBookingDto[]>(`${this.baseUrl}/bookings/all`);
  }

  /** Applique une transition de statut sur une réservation (204 No Content). */
  updateStatus(id: string, action: BookingStatusAction): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/bookings/${id}/status`, { action });
  }

  /**
   * Réconcilie le paiement d'une réservation (virement Interac reçu) → CONFIRME la réservation
   * (204 No Content). Réservé à l'administration (politique « AdminOnly » côté API) — EPIC 7.3.
   */
  confirmPayment(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/bookings/${id}/confirm-payment`, {});
  }
}
