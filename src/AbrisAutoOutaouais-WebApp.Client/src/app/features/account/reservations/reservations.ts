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
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';
import { BookingService } from '../../../core/services/booking.service';
import { ToastService } from '../../../core/services/toast.service';
import { AvailableSlotDto, BookingSummaryDto } from '../../../core/models/booking.model';

/**
 * Page « Mes réservations » (installations d'abris).
 * Tente de charger les réservations ; dégrade vers un état vide gracieux
 * si l'endpoint est absent ou échoue.
 *
 * Report : une réservation à venir (Pending/Confirmed) peut être déplacée vers un autre
 * créneau disponible via une boîte de dialogue accessible (role="alertdialog", focus capturé,
 * Échap, retour du focus au bouton déclencheur — WCAG 2.4.3 ; radiogroup natif des créneaux).
 * Le résultat est annoncé par le toast (région aria-live globale).
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
              <p class="account-list__ref">
                @switch (booking.type) {
                  @case ('Installation') { <ng-container i18n="@@booking.type.installation">Installation</ng-container> }
                  @case ('Delivery') { <ng-container i18n="@@booking.type.delivery">Livraison</ng-container> }
                  @case ('Removal') { <ng-container i18n="@@booking.type.removal">Démontage</ng-container> }
                  @default { {{ booking.type }} }
                }
                — {{ booking.city }}
              </p>
              <p class="account-list__meta">
                {{ booking.slotStart | date:'medium':'':'fr-CA' }}
              </p>
            </div>
            <span class="account-list__status">{{ booking.status }}</span>
            @if (isReschedulable(booking.status)) {
            <button type="button" class="btn btn--ghost account-list__action"
                    (click)="askReschedule(booking.id, $event)"
                    [attr.aria-label]="rescheduleAria(booking)">
              <span i18n="@@account.reservations.reschedule">Reporter</span>
            </button>
            }
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

    @if (pendingRescheduleId(); as bookingId) {
    <div class="account-overlay" (click)="dismissReschedule()">
      <div #rescheduleDialog class="account-dialog" role="alertdialog" aria-modal="true" tabindex="-1"
           aria-labelledby="resched-title" aria-describedby="resched-desc"
           (click)="$event.stopPropagation()" (keydown.escape)="dismissReschedule()">
        <h2 id="resched-title" i18n="@@account.reservations.reschedule.title">
          Reporter la réservation
        </h2>
        <p id="resched-desc" i18n="@@account.reservations.reschedule.desc">
          Choisissez un nouveau créneau disponible.
        </p>

        @if (slotsLoading()) {
        <p role="status" aria-busy="true" i18n="@@account.reservations.reschedule.loading">
          Chargement des créneaux…
        </p>
        } @else if (slots().length > 0) {
        <fieldset class="reschedule__slots">
          <legend class="sr-only" i18n="@@account.reservations.reschedule.legend">
            Créneaux disponibles
          </legend>
          @for (slot of slots(); track slot.start) {
          <label class="reschedule__slot"
                 [class.reschedule__slot--selected]="selectedSlot() === slot.start">
            <input type="radio" name="resched-slot" class="sr-only"
                   [value]="slot.start" [checked]="selectedSlot() === slot.start"
                   (change)="selectSlot(slot.start)" />
            {{ slot.start | date:'EEE d MMM, HH:mm':'':'fr-CA' }}
          </label>
          }
        </fieldset>
        } @else {
        <p role="status" i18n="@@account.reservations.reschedule.empty">
          Aucun créneau disponible pour le moment.
        </p>
        }

        <div class="account-dialog__actions">
          <button type="button" class="btn btn--primary" (click)="confirmReschedule()"
                  [disabled]="!selectedSlot() || rescheduling()" [attr.aria-busy]="rescheduling()"
                  i18n="@@account.reservations.reschedule.confirm">
            Confirmer le report
          </button>
          <button type="button" class="btn btn--ghost" (click)="dismissReschedule()"
                  i18n="@@account.reservations.reschedule.dismiss">
            Annuler
          </button>
        </div>
      </div>
    </div>
    }
  `,
  styleUrl: '../account-shared.scss',
})
export class ReservationsComponent implements OnInit {
  private readonly bookingService = inject(BookingService);
  private readonly toast = inject(ToastService);

  protected readonly bookings = signal<BookingSummaryDto[]>([]);
  protected readonly loading = signal(true);

  /** Id de la réservation en cours de report (null = aucune). */
  protected readonly pendingRescheduleId = signal<string | null>(null);
  protected readonly slots = signal<AvailableSlotDto[]>([]);
  protected readonly slotsLoading = signal(false);
  protected readonly selectedSlot = signal<string | null>(null);
  protected readonly rescheduling = signal(false);

  private readonly rescheduleDialog = viewChild<ElementRef<HTMLElement>>('rescheduleDialog');
  private triggerEl: HTMLElement | null = null;

  constructor() {
    // À l'ouverture, déplace le focus dans la boîte de dialogue (lecture de la viewChild
    // pour que l'effet se ré-exécute une fois le @if rendu).
    effect(() => {
      const dialog = this.rescheduleDialog();
      if (this.pendingRescheduleId() && dialog) {
        dialog.nativeElement.focus();
      }
    });
  }

  ngOnInit(): void {
    this.bookingService.getMyBookings().subscribe({
      next: bookings => {
        this.bookings.set(bookings ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected isReschedulable(status: string): boolean {
    return status === 'Pending' || status === 'Confirmed';
  }

  protected rescheduleAria(booking: BookingSummaryDto): string {
    return `${$localize`:@@account.reservations.reschedule.aria:Reporter la réservation`} — ${booking.city}`;
  }

  protected selectSlot(start: string): void {
    this.selectedSlot.set(start);
  }

  protected askReschedule(id: string, event: MouseEvent): void {
    this.triggerEl = event.currentTarget as HTMLElement;
    this.selectedSlot.set(null);
    this.pendingRescheduleId.set(id);
    this.loadSlots();
  }

  protected dismissReschedule(): void {
    this.closeDialog();
  }

  protected confirmReschedule(): void {
    const id = this.pendingRescheduleId();
    const slot = this.selectedSlot();
    if (!id || !slot || this.rescheduling()) return;

    this.rescheduling.set(true);
    this.bookingService.reschedule(id, { newSlotStart: slot }).subscribe({
      next: () => {
        // La réservation reste visible (statut inchangé), seule l'heure change.
        this.bookings.update(list =>
          list.map(b => (b.id === id ? { ...b, slotStart: slot } : b)),
        );
        this.rescheduling.set(false);
        this.closeDialog();
        this.toast.show(
          $localize`:@@account.reservations.reschedule.success:Réservation reportée.`,
          'success',
        );
      },
      error: () => {
        this.rescheduling.set(false);
        this.closeDialog();
        this.toast.show(
          $localize`:@@account.reservations.reschedule.error:Le report a échoué. Veuillez réessayer.`,
          'error',
        );
      },
    });
  }

  private loadSlots(): void {
    this.slots.set([]);
    this.slotsLoading.set(true);
    const today = new Date();
    const from = this.toIsoDate(today);
    const to = this.toIsoDate(new Date(today.getTime() + 14 * 86_400_000));

    this.bookingService.getAvailableSlots(from, to).subscribe({
      next: slots => {
        this.slots.set(slots ?? []);
        this.slotsLoading.set(false);
      },
      error: () => {
        this.slots.set([]);
        this.slotsLoading.set(false);
      },
    });
  }

  /** Ferme le dialogue, réinitialise la sélection et rend le focus au bouton déclencheur. */
  private closeDialog(): void {
    this.pendingRescheduleId.set(null);
    this.slots.set([]);
    this.selectedSlot.set(null);
    this.triggerEl?.focus(); // la ligne reste affichée (statut inchangé) → bouton présent
    this.triggerEl = null;
  }

  private toIsoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }
}
