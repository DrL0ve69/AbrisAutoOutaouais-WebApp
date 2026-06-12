import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';
import { RentalService } from '../../../core/services/rental.service';
import { ToastService } from '../../../core/services/toast.service';
import { RentalSummaryDto } from '../../../core/models/rental.model';

/**
 * Page « Mes locations » (locations saisonnières d'abris).
 * Tente de charger les locations ; dégrade vers un état vide gracieux
 * si l'endpoint est absent ou échoue.
 *
 * Annulation : une location « Active » peut être annulée via une boîte de dialogue
 * de confirmation accessible (role="alertdialog", focus capturé, Échap, retour du
 * focus sur le bouton déclencheur — WCAG 2.4.3). Le résultat est annoncé par le toast
 * (région aria-live globale).
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
          <h1 #heading id="rentals-heading" tabindex="-1" i18n="@@account.rentals.title">Mes locations</h1>
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
            <span class="account-list__status">{{ statusLabel(rental.status) }}</span>
            <span class="account-list__amount">
              {{ rental.monthlyRate | currency:'CAD':'symbol-narrow':'1.2-2':'fr-CA' }}<span i18n="@@account.rentals.perMonth">/mois</span>
            </span>
            @if (isCancellable(rental.status)) {
            <button type="button" class="btn btn--ghost account-list__cancel"
                    (click)="askCancel(rental.id, $event)"
                    [attr.aria-label]="cancelAria(rental.productName)">
              <span i18n="@@account.rentals.cancel">Annuler</span>
            </button>
            }
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

    @if (pendingCancelId(); as cancelId) {
    <div class="account-overlay" (click)="dismissCancel()">
      <div #cancelDialog class="account-dialog" role="alertdialog" aria-modal="true" tabindex="-1"
           aria-labelledby="cancel-title" aria-describedby="cancel-desc"
           (click)="$event.stopPropagation()" (keydown.escape)="dismissCancel()">
        <h2 id="cancel-title" i18n="@@account.rentals.cancel.title">Annuler cette location ?</h2>
        <p id="cancel-desc">
          <ng-container i18n="@@account.rentals.cancel.message">Voulez-vous vraiment annuler la location</ng-container>
          <strong>{{ rentalName(cancelId) }}</strong><ng-container i18n="@@account.rentals.cancel.message2">? Cette action est définitive.</ng-container>
        </p>
        <div class="account-dialog__actions">
          <button type="button" class="btn btn--danger" (click)="confirmCancel()"
                  [disabled]="cancelling()" [attr.aria-busy]="cancelling()"
                  i18n="@@account.rentals.cancel.confirm">
            Confirmer l'annulation
          </button>
          <button type="button" class="btn btn--ghost" (click)="dismissCancel()"
                  i18n="@@account.rentals.cancel.dismiss">
            Garder la location
          </button>
        </div>
      </div>
    </div>
    }
  `,
  styleUrl: '../account-shared.scss',
})
export class RentalsComponent implements OnInit {
  private readonly rentalService = inject(RentalService);
  private readonly toast = inject(ToastService);

  protected readonly rentals = signal<RentalSummaryDto[]>([]);
  protected readonly loading = signal(true);

  /** Id de la location en attente de confirmation d'annulation (null = aucune). */
  protected readonly pendingCancelId = signal<string | null>(null);
  protected readonly cancelling = signal(false);

  private readonly cancelDialog = viewChild<ElementRef<HTMLElement>>('cancelDialog');
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  /** Bouton ayant ouvert la boîte de dialogue — pour lui rendre le focus (WCAG 2.4.3). */
  private triggerEl: HTMLElement | null = null;

  constructor() {
    // À l'ouverture, déplace le focus dans la boîte de dialogue. On LIT cancelDialog()
    // dans l'effet pour qu'il se ré-exécute quand le @if a rendu l'élément (sinon le
    // focus dépendrait de l'ordre de rendu et raterait silencieusement).
    effect(() => {
      const dialog = this.cancelDialog();
      if (this.pendingCancelId() && dialog) {
        dialog.nativeElement.focus();
      }
    });
  }

  ngOnInit(): void {
    this.rentalService.getMyRentals().subscribe({
      next: rentals => {
        this.rentals.set(rentals ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected isCancellable(status: string): boolean {
    return status === 'Active';
  }

  protected statusLabel(status: string): string {
    switch (status) {
      case 'Active':
        return $localize`:@@account.rentals.status.active:Active`;
      case 'Cancelled':
        return $localize`:@@account.rentals.status.cancelled:Annulée`;
      case 'Expired':
        return $localize`:@@account.rentals.status.expired:Expirée`;
      default:
        return status;
    }
  }

  protected cancelAria(productName: string): string {
    return `${$localize`:@@account.rentals.cancel.aria:Annuler la location`} ${productName}`;
  }

  protected rentalName(id: string | null): string {
    return this.rentals().find(r => r.id === id)?.productName ?? '';
  }

  protected askCancel(id: string, event: MouseEvent): void {
    this.triggerEl = event.currentTarget as HTMLElement;
    this.pendingCancelId.set(id);
  }

  protected dismissCancel(): void {
    // Dialogue refermé sans annuler : la ligne (donc le bouton déclencheur) existe
    // toujours, on lui rend le focus immédiatement (WCAG 2.4.3).
    this.pendingCancelId.set(null);
    this.focusTrigger();
  }

  protected confirmCancel(): void {
    const id = this.pendingCancelId();
    if (!id || this.cancelling()) return;

    this.cancelling.set(true);
    this.rentalService.cancel(id).subscribe({
      next: () => {
        this.rentals.update(list =>
          list.map(r => (r.id === id ? { ...r, status: 'Cancelled' } : r)),
        );
        this.cancelling.set(false);
        this.pendingCancelId.set(null);
        // Le bouton déclencheur va disparaître (statut → Annulée) : on déplace le focus
        // sur le titre, APRÈS le rendu, sinon il se perdrait sur <body>.
        this.focusHeadingAfterRender();
        this.toast.show(
          $localize`:@@account.rentals.cancel.success:Location annulée.`,
          'success',
        );
      },
      error: () => {
        // Échec : rien n'a changé, la ligne et son bouton restent → retour au déclencheur.
        this.cancelling.set(false);
        this.pendingCancelId.set(null);
        this.focusTrigger();
        this.toast.show(
          $localize`:@@account.rentals.cancel.error:L'annulation a échoué. Veuillez réessayer.`,
          'error',
        );
      },
    });
  }

  /** Rend le focus au bouton déclencheur (toujours présent : la ligne n'a pas changé). */
  private focusTrigger(): void {
    this.triggerEl?.focus();
    this.triggerEl = null;
  }

  /** Déplace le focus sur le titre une fois le bouton déclencheur retiré du DOM. */
  private focusHeadingAfterRender(): void {
    this.triggerEl = null;
    setTimeout(() => this.heading()?.nativeElement.focus());
  }
}
