import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { OrderSummaryDto, PlaceOrderRequest } from '../models/order.model';

/** Commandes de l'utilisateur connecté (toutes les routes exigent un JWT). */
@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  placeOrder(request: PlaceOrderRequest): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.baseUrl}/orders`, request);
  }

  getMyOrders(): Observable<OrderSummaryDto[]> {
    return this.http.get<OrderSummaryDto[]>(`${this.baseUrl}/orders/mine`);
  }

  cancel(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/orders/${id}/cancel`, {});
  }
}
