import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  OrderSummaryDto,
  PlaceOrderRequest,
  PlaceOrderResponse,
} from '../models/order.model';

/** Commandes de l'utilisateur connecté (toutes les routes exigent un JWT). */
@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /**
   * Passe une commande (201). La réponse porte l'id ET les instructions de paiement
   * (virement Interac) que la caisse affiche au client (EPIC 7).
   */
  placeOrder(request: PlaceOrderRequest): Observable<PlaceOrderResponse> {
    return this.http.post<PlaceOrderResponse>(`${this.baseUrl}/orders`, request);
  }

  getMyOrders(): Observable<OrderSummaryDto[]> {
    return this.http.get<OrderSummaryDto[]>(`${this.baseUrl}/orders/mine`);
  }

  cancel(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/orders/${id}/cancel`, {});
  }
}
