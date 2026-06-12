import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AvailableSlotDto,
  BookingSummaryDto,
  CreateBookingRequest,
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

  createBooking(request: CreateBookingRequest): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.baseUrl}/bookings`, request);
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
