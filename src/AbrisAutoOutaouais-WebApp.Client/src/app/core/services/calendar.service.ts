import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CalendarBookingDto } from '../models/calendar.model';

/**
 * Lecture du calendrier planning (US-11.1) : agrège les réservations existantes sur une
 * fenêtre de dates. Réservé au personnel (Admin/Staff) — le JWT est attaché par
 * l'intercepteur HTTP et l'API exige la politique « StaffOrAbove ». Lecture seule :
 * aucune mutation de RDV ici. Singleton applicatif — providedIn: 'root'.
 */
@Injectable({ providedIn: 'root' })
export class CalendarService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /**
   * Réservations dont le créneau débute dans [from, to] (bornes incluses, format `YYYY-MM-DD`).
   */
  getCalendar(from: string, to: string): Observable<CalendarBookingDto[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<CalendarBookingDto[]>(`${this.baseUrl}/bookings/calendar`, { params });
  }
}
