import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';
import { RentalService } from '../../../core/services/rental.service';
import { RentalSummaryDto } from '../../../core/models/rental.model';

/**
 * Page « Mes locations » (locations saisonnières d'abris).
 * Tente de charger les locations ; dégrade vers un état vide gracieux
 * si l'endpoint est absent ou échoue.
 */
@Component({
  selector: 'app-rentals',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DatePipe, RouterLink, EmptyStateComponent],
  template: `
    <section class="account-sub" aria-labelledby="rentals-heading">
      <div class="container">
        <header class="account-sub__head">
          <a routerLink="/mon-compte/profil" class="account-sub__back" i18n="@@account.back">
            ← Mon compte
          </a>
          <h1 id="rentals-heading" i18n="@@account.rentals.title">Mes locations</h1>
          <p class="account-sub__lead" i18n="@@account.rentals.lead">
            Consultez vos locations saisonnières d'abris en cours et passées.
          </p>
        </header>

        @if (loading()) {
        <p class="account-sub__loading" role="status" aria-busy="true"
           i18n="@@account.rentals.loading">
          Chargement de vos locations…
        </p>
        } @else if (rentals().length > 0) {
        <ul class="account-list" role="list">
          @for (rental of rentals(); track rental.id) {
          <li class="account-list__row">
            <div class="account-list__main">
              <p class="account-list__ref">{{ rental.productName }}</p>
              <p class="account-list__meta">
                {{ rental.startDate | date:'longDate':'':'fr-CA' }}
                –
                {{ rental.endDate | date:'longDate':'':'fr-CA' }}
              </p>
            </div>
            <span class="account-list__status">{{ rental.status }}</span>
            <span class="account-list__amount">
              {{ rental.monthlyRate | currency:'CAD':'symbol-narrow':'1.2-2':'fr-CA' }}<span i18n="@@account.rentals.perMonth">/mois</span>
            </span>
          </li>
          }
        </ul>
        } @else {
        <app-empty-state
          icon="🏠"
          message="Aucune location pour le moment"
          i18n-message="@@account.rentals.empty"
          hint="Vos locations saisonnières apparaîtront ici dès qu'elles seront disponibles."
          i18n-hint="@@account.rentals.emptyHint" />
        }
      </div>
    </section>
  `,
  styleUrl: '../account-shared.scss',
})
export class RentalsComponent implements OnInit {
  private readonly rentalService = inject(RentalService);

  protected readonly rentals = signal<RentalSummaryDto[]>([]);
  protected readonly loading = signal(true);

  ngOnInit(): void {
    this.rentalService.getMyRentals().subscribe({
      next: rentals => {
        this.rentals.set(rentals ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
