import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';

/** Correspond à un BookingDto côté backend (endpoint à venir). */
interface BookingDto {
  readonly id: string;
  readonly reference: string;
  readonly scheduledAt: string;
  readonly status: string;
}

/**
 * Page « Mes réservations » (installations d'abris).
 * Tente de charger les réservations ; dégrade vers un état vide gracieux
 * si l'endpoint est absent ou échoue.
 */
@Component({
  selector: 'app-reservations',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, EmptyStateComponent],
  template: `
    <section class="account-sub" aria-labelledby="reservations-heading">
      <div class="container">
        <header class="account-sub__head">
          <a routerLink="/mon-compte/profil" class="account-sub__back" i18n="@@account.back">
            ← Mon compte
          </a>
          <h1 id="reservations-heading" i18n="@@account.reservations.title">
            Mes réservations
          </h1>
          <p class="account-sub__lead" i18n="@@account.reservations.lead">
            Suivez vos rendez-vous d'installation d'abris.
          </p>
        </header>

        @if (loading()) {
        <p class="account-sub__loading" role="status" aria-busy="true"
           i18n="@@account.reservations.loading">
          Chargement de vos réservations…
        </p>
        } @else if (bookings().length > 0) {
        <ul class="account-list" role="list">
          @for (booking of bookings(); track booking.id) {
          <li class="account-list__row">
            <div class="account-list__main">
              <p class="account-list__ref">{{ booking.reference }}</p>
              <p class="account-list__meta">
                {{ booking.scheduledAt | date:'medium':'':'fr-CA' }}
              </p>
            </div>
            <span class="account-list__status">{{ booking.status }}</span>
          </li>
          }
        </ul>
        } @else {
        <app-empty-state
          icon="📅"
          message="Aucune réservation pour le moment"
          i18n-message="@@account.reservations.empty"
          hint="Réservez une installation depuis la page dédiée pour la voir apparaître ici."
          i18n-hint="@@account.reservations.emptyHint" />
        }
      </div>
    </section>
  `,
  styleUrl: '../account-shared.scss',
})
export class ReservationsComponent implements OnInit {
  private readonly http = inject(HttpClient);

  protected readonly bookings = signal<BookingDto[]>([]);
  protected readonly loading = signal(true);

  ngOnInit(): void {
    this.http
      .get<BookingDto[]>(`${environment.apiUrl}/bookings/mine`)
      .subscribe({
        next: bookings => {
          this.bookings.set(bookings ?? []);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
