import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateRentalContractRequest,
  RentalSummaryDto,
} from '../models/rental.model';

/** Contrats de location d'abris de l'utilisateur connecté. */
@Injectable({ providedIn: 'root' })
export class RentalService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  createRental(request: CreateRentalContractRequest): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.baseUrl}/rentals`, request);
  }

  getMyRentals(): Observable<RentalSummaryDto[]> {
    return this.http.get<RentalSummaryDto[]>(`${this.baseUrl}/rentals/mine`);
  }

  cancel(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/rentals/${id}/cancel`, {});
  }
}
