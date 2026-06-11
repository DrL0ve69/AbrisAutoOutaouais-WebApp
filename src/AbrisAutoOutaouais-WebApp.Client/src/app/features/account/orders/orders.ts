import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';

/** Correspond à un OrderDto côté backend (endpoint à venir). */
interface OrderDto {
  readonly id: string;
  readonly reference: string;
  readonly createdAt: string;
  readonly status: string;
  readonly total: number;
}

/**
 * Page « Mes commandes ».
 * Tente de charger les commandes de l'utilisateur. L'endpoint n'existe pas
 * forcément encore : en cas d'erreur, on dégrade vers un état vide gracieux
 * sans jamais planter la page.
 */
@Component({
  selector: 'app-orders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DatePipe, RouterLink, EmptyStateComponent],
  template: `
    <section class="account-sub" aria-labelledby="orders-heading">
      <div class="container">
        <header class="account-sub__head">
          <a routerLink="/mon-compte/profil" class="account-sub__back" i18n="@@account.back">
            ← Mon compte
          </a>
          <h1 id="orders-heading" i18n="@@account.orders.title">Mes commandes</h1>
          <p class="account-sub__lead" i18n="@@account.orders.lead">
            Retrouvez l'historique de vos achats d'abris et accessoires.
          </p>
        </header>

        @if (loading()) {
        <p class="account-sub__loading" role="status" aria-busy="true"
           i18n="@@account.orders.loading">
          Chargement de vos commandes…
        </p>
        } @else if (orders().length > 0) {
        <ul class="account-list" role="list">
          @for (order of orders(); track order.id) {
          <li class="account-list__row">
            <div class="account-list__main">
              <p class="account-list__ref">{{ order.reference }}</p>
              <p class="account-list__meta">{{ order.createdAt | date:'longDate':'':'fr-CA' }}</p>
            </div>
            <span class="account-list__status">{{ order.status }}</span>
            <span class="account-list__amount">
              {{ order.total | currency:'CAD':'symbol-narrow':'1.2-2':'fr-CA' }}
            </span>
          </li>
          }
        </ul>
        } @else {
        <app-empty-state
          icon="📦"
          message="Aucune commande pour le moment"
          i18n-message="@@account.orders.empty"
          hint="Vos prochaines commandes apparaîtront ici une fois passées."
          i18n-hint="@@account.orders.emptyHint" />
        }
      </div>
    </section>
  `,
  styleUrl: '../account-shared.scss',
})
export class OrdersComponent implements OnInit {
  private readonly http = inject(HttpClient);

  protected readonly orders = signal<OrderDto[]>([]);
  protected readonly loading = signal(true);

  ngOnInit(): void {
    this.http
      .get<OrderDto[]>(`${environment.apiUrl}/orders/mine`)
      .subscribe({
        next: orders => {
          this.orders.set(orders ?? []);
          this.loading.set(false);
        },
        // Endpoint potentiellement absent → état vide gracieux.
        error: () => this.loading.set(false),
      });
  }
}
