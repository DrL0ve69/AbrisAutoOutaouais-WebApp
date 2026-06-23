import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminOrderDto, OrderStatusAction } from '../models/order.model';

/**
 * Opérations d'administration des commandes (consultation et transitions de statut).
 * Réservé aux administrateurs — le JWT est attaché par l'intercepteur HTTP existant
 * et l'API exige la politique « AdminOnly ».
 * Singleton applicatif — providedIn: 'root'.
 */
@Injectable({ providedIn: 'root' })
export class AdminOrderService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /** Toutes les commandes, tous clients confondus. */
  getAllOrders(): Observable<AdminOrderDto[]> {
    return this.http.get<AdminOrderDto[]>(`${this.baseUrl}/orders/all`);
  }

  /** Applique une transition de statut sur une commande (204 No Content). */
  updateStatus(id: string, action: OrderStatusAction): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/orders/${id}/status`, { action });
  }

  /**
   * Réconcilie le paiement d'une commande (virement Interac reçu) → marque PAYÉE (204 No Content).
   * Réservé à l'administration (politique « AdminOnly » côté API) — EPIC 7.
   */
  confirmPayment(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/orders/${id}/confirm-payment`, {});
  }
}
