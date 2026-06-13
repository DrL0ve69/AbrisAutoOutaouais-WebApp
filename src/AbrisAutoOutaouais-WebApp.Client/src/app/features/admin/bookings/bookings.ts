import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminBookingService } from '../../../core/services/admin-booking.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  AdminBookingDto,
  BookingStatus,
  BookingStatusAction,
  BookingType,
} from '../../../core/models/booking.model';

/** Action de statut affichable pour une réservation (libellé + transition). */
interface StatusActionView {
  readonly action: BookingStatusAction;
  readonly label: string;
  readonly danger: boolean;
}

/** Action en attente de confirmation dans la boîte de dialogue. */
interface PendingAction {
  readonly booking: AdminBookingDto;
  readonly action: BookingStatusAction;
}

/**
 * Administration des réservations — liste accessible avec transitions de statut.
 * Accès protégé par authGuard + adminGuard (cf. app.routes.ts → /admin).
 * Machine à états côté API : Pending → Confirmed|Cancelled ; Confirmed → Completed|Cancelled.
 * WCAG AA : table sémantique (caption, scope), confirmation via role="alertdialog"
 * (focus capturé, Échap, retour du focus — WCAG 2.4.3), résultat annoncé par le toast
 * (région aria-live globale). Le déclencheur disparaissant après une transition réussie,
 * le focus revient sur le titre APRÈS le rendu (leçon L-006).
 */
@Component({
  selector: 'app-admin-bookings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe],
  templateUrl: './bookings.html',
  styleUrl: '../admin-shared.scss',
})
export class AdminBookingsComponent {
  private readonly admin = inject(AdminBookingService);
  private readonly toast = inject(ToastService);

  protected readonly items = signal<readonly AdminBookingDto[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  /** Action en attente de confirmation (null = aucune boîte de dialogue ouverte). */
  protected readonly pending = signal<PendingAction | null>(null);
  protected readonly busy = signal(false);

  private readonly dialog = viewChild<ElementRef<HTMLElement>>('confirmDialog');
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  /** Bouton ayant ouvert la boîte de dialogue — pour lui rendre le focus (WCAG 2.4.3). */
  private triggerEl: HTMLElement | null = null;

  constructor() {
    // À l'ouverture, déplace le focus dans la boîte de dialogue. On LIT dialog()
    // dans l'effet pour qu'il se ré-exécute quand le @if a rendu l'élément.
    effect(() => {
      const dialog = this.dialog();
      if (this.pending() && dialog) {
        dialog.nativeElement.focus();
      }
    });
    this.loadBookings();
  }

  protected loadBookings(): void {
    this.loading.set(true);
    this.error.set(false);
    this.admin.getAllBookings().subscribe({
      next: bookings => {
        this.items.set(bookings);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
        this.toast.show(
          $localize`:@@admin.bookings.toast.loadError:Échec du chargement des réservations.`,
          'error',
        );
      },
    });
  }

  /** Libellé français du statut, affiché dans le badge. */
  protected statusLabel(status: BookingStatus): string {
    switch (status) {
      case 'Pending':
        return $localize`:@@admin.bookings.status.pending:En attente`;
      case 'Confirmed':
        return $localize`:@@admin.bookings.status.confirmed:Confirmée`;
      case 'Completed':
        return $localize`:@@admin.bookings.status.completed:Complétée`;
      case 'Cancelled':
        return $localize`:@@admin.bookings.status.cancelled:Annulée`;
    }
  }

  /** Libellé français du type d'intervention. */
  protected typeLabel(type: BookingType): string {
    switch (type) {
      case 'Installation':
        return $localize`:@@admin.bookings.type.installation:Installation`;
      case 'Delivery':
        return $localize`:@@admin.bookings.type.delivery:Livraison`;
      case 'Removal':
        return $localize`:@@admin.bookings.type.removal:Démontage`;
    }
  }

  /** Suffixe de classe BEM pour la couleur du badge selon le statut. */
  protected statusModifier(status: BookingStatus): string {
    return status.toLowerCase();
  }

  /** Actions contextuelles disponibles pour le statut courant (machine à états). */
  protected actionsFor(status: BookingStatus): readonly StatusActionView[] {
    switch (status) {
      case 'Pending':
        return [
          {
            action: 'confirm',
            label: $localize`:@@admin.bookings.action.confirm:Confirmer`,
            danger: false,
          },
          {
            action: 'cancel',
            label: $localize`:@@admin.bookings.action.cancel:Annuler`,
            danger: true,
          },
        ];
      case 'Confirmed':
        return [
          {
            action: 'complete',
            label: $localize`:@@admin.bookings.action.complete:Marquer complétée`,
            danger: false,
          },
          {
            action: 'cancel',
            label: $localize`:@@admin.bookings.action.cancel:Annuler`,
            danger: true,
          },
        ];
      case 'Completed':
      case 'Cancelled':
        return [];
    }
  }

  /** Titre de la boîte de dialogue selon l'action à confirmer. */
  protected dialogTitle(action: BookingStatusAction): string {
    switch (action) {
      case 'confirm':
        return $localize`:@@admin.bookings.dialog.confirmTitle:Confirmer cette réservation ?`;
      case 'complete':
        return $localize`:@@admin.bookings.dialog.completeTitle:Marquer cette réservation comme complétée ?`;
      case 'cancel':
        return $localize`:@@admin.bookings.dialog.cancelTitle:Annuler cette réservation ?`;
    }
  }

  /** Étiquette accessible d'un bouton d'action de ligne (désambiguïse les lignes). */
  protected actionAria(label: string, booking: AdminBookingDto): string {
    return `${label} — ${booking.customerName}`;
  }

  protected askAction(booking: AdminBookingDto, action: BookingStatusAction, event: MouseEvent): void {
    this.triggerEl = event.currentTarget as HTMLElement;
    this.pending.set({ booking, action });
  }

  protected dismiss(): void {
    // Dialogue refermé sans agir : la ligne (donc le bouton déclencheur) existe
    // toujours, on lui rend le focus immédiatement (WCAG 2.4.3).
    this.pending.set(null);
    this.focusTrigger();
  }

  protected confirmAction(): void {
    const pending = this.pending();
    if (!pending || this.busy()) return;

    this.busy.set(true);
    this.admin.updateStatus(pending.booking.id, pending.action).subscribe({
      next: () => {
        const newStatus = this.statusAfter(pending.action);
        this.items.update(list =>
          list.map(b => (b.id === pending.booking.id ? { ...b, status: newStatus } : b)),
        );
        this.busy.set(false);
        this.pending.set(null);
        // Le bouton déclencheur disparaît (les actions changent avec le statut) :
        // focus sur le titre APRÈS le rendu, sinon il se perdrait sur <body> (L-006).
        this.focusHeadingAfterRender();
        this.toast.show(
          $localize`:@@admin.bookings.toast.updated:Statut de la réservation mis à jour.`,
          'success',
        );
      },
      error: () => {
        // Échec : rien n'a changé, la ligne et son bouton restent → retour au déclencheur.
        this.busy.set(false);
        this.pending.set(null);
        this.focusTrigger();
        this.toast.show(
          $localize`:@@admin.bookings.toast.updateError:La mise à jour du statut a échoué.`,
          'error',
        );
      },
    });
  }

  /** Statut résultant d'une action réussie (miroir de la machine à états serveur). */
  private statusAfter(action: BookingStatusAction): BookingStatus {
    switch (action) {
      case 'confirm':
        return 'Confirmed';
      case 'complete':
        return 'Completed';
      case 'cancel':
        return 'Cancelled';
    }
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
