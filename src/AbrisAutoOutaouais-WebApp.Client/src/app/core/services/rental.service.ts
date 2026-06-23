import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateRentalContractRequest,
  CreateRentalContractResponse,
  RentalSummaryDto,
} from '../models/rental.model';

/** Contrats de location d'abris de l'utilisateur connecté. */
@Injectable({ providedIn: 'root' })
export class RentalService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /**
   * Crée un contrat de location et renvoie l'identifiant + les instructions de paiement (virement
   * Interac, EPIC 7.2). Le contrat reste `PendingPayment` jusqu'à la réconciliation admin.
   */
  createRental(request: CreateRentalContractRequest): Observable<CreateRentalContractResponse> {
    return this.http.post<CreateRentalContractResponse>(`${this.baseUrl}/rentals`, request);
  }

  getMyRentals(): Observable<RentalSummaryDto[]> {
    return this.http.get<RentalSummaryDto[]>(`${this.baseUrl}/rentals/mine`);
  }

  cancel(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/rentals/${id}/cancel`, {});
  }
}
