import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AvailableSlotDto,
  BookingSummaryDto,
  CreateBookingRequest,
  CreateBookingResponse,
  RescheduleBookingRequest,
} from '../models/booking.model';

/** Réservations d'installation / livraison / démontage de l'utilisateur connecté. */
@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /** Créneaux disponibles entre deux dates (public). `from`/`to` au format yyyy-MM-dd. */
  getAvailableSlots(from: string, to: string): Observable<AvailableSlotDto[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<AvailableSlotDto[]>(
      `${this.baseUrl}/bookings/available-slots`,
      { params },
    );
  }

  /**
   * Crée une réservation et renvoie l'identifiant + les instructions de paiement (virement Interac,
   * EPIC 7.3). La réservation reste `PendingPayment` jusqu'à la réconciliation admin.
   */
  createBooking(request: CreateBookingRequest): Observable<CreateBookingResponse> {
    return this.http.post<CreateBookingResponse>(`${this.baseUrl}/bookings`, request);
  }

  getMyBookings(): Observable<BookingSummaryDto[]> {
    return this.http.get<BookingSummaryDto[]>(`${this.baseUrl}/bookings/mine`);
  }

  cancel(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/bookings/${id}/cancel`, {});
  }

  reschedule(id: string, request: RescheduleBookingRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/bookings/${id}/reschedule`, request);
  }
}
