import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminRentalService } from '../../../core/services/admin-rental.service';
import { ToastService } from '../../../core/services/toast.service';
import { AdminRentalDto, RentalStatus } from '../../../core/models/rental.model';

/**
 * Administration des locations — liste accessible avec annulation administrative.
 * Accès protégé par authGuard + adminGuard (cf. app.routes.ts → /admin).
 * Seule action exposée : annuler un contrat « Actif » (POST /rentals/{id}/admin-cancel,
 * sans vérification de propriété). L'expiration est calendaire (EndDate) — pas une
 * action admin, le domaine n'expose pas de transition manuelle vers « Expirée ».
 * WCAG AA : table sémantique, confirmation via role="alertdialog" (focus capturé,
 * Échap, retour du focus — WCAG 2.4.3), résultat annoncé par le toast (aria-live).
 * Le déclencheur disparaissant après annulation, focus sur le titre APRÈS rendu (L-006).
 */
@Component({
  selector: 'app-admin-rentals',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CurrencyPipe, DatePipe],
  templateUrl: './rentals.html',
  styleUrl: '../admin-shared.scss',
})
export class AdminRentalsComponent {
  private readonly admin = inject(AdminRentalService);
  private readonly toast = inject(ToastService);

  protected readonly items = signal<readonly AdminRentalDto[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  /** Contrat en attente de confirmation d'annulation (null = aucune). */
  protected readonly pendingCancel = signal<AdminRentalDto | null>(null);
  protected readonly busy = signal(false);

  private readonly dialog = viewChild<ElementRef<HTMLElement>>('confirmDialog');
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  /** Bouton ayant ouvert la boîte de dialogue — pour lui rendre le focus (WCAG 2.4.3). */
  private triggerEl: HTMLElement | null = null;

  constructor() {
    // À l'ouverture, déplace le focus dans la boîte de dialogue (l'effet se
    // ré-exécute quand le @if a rendu l'élément).
    effect(() => {
      const dialog = this.dialog();
      if (this.pendingCancel() && dialog) {
        dialog.nativeElement.focus();
      }
    });
    this.loadRentals();
  }

  protected loadRentals(): void {
    this.loading.set(true);
    this.error.set(false);
    this.admin.getAllRentals().subscribe({
      next: rentals => {
        this.items.set(rentals);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
        this.toast.show(
          $localize`:@@admin.rentals.toast.loadError:Échec du chargement des locations.`,
          'error',
        );
      },
    });
  }

  /** Libellé français du statut, affiché dans le badge. */
  protected statusLabel(status: RentalStatus): string {
    switch (status) {
      case 'Active':
        return $localize`:@@admin.rentals.status.active:Active`;
      case 'Expired':
        return $localize`:@@admin.rentals.status.expired:Expirée`;
      case 'Cancelled':
        return $localize`:@@admin.rentals.status.cancelled:Annulée`;
    }
  }

  /** Suffixe de classe BEM pour la couleur du badge selon le statut. */
  protected statusModifier(status: RentalStatus): string {
    return status.toLowerCase();
  }

  /** Seul un contrat actif peut être annulé par l'administration. */
  protected isCancellable(status: RentalStatus): boolean {
    return status === 'Active';
  }

  /** Étiquette accessible du bouton d'annulation (désambiguïse les lignes). */
  protected cancelAria(rental: AdminRentalDto): string {
    return `${$localize`:@@admin.rentals.cancel.aria:Annuler la location`} ${rental.productName} — ${rental.customerName}`;
  }

  protected askCancel(rental: AdminRentalDto, event: MouseEvent): void {
    this.triggerEl = event.currentTarget as HTMLElement;
    this.pendingCancel.set(rental);
  }

  protected dismiss(): void {
    // Dialogue refermé sans annuler : le bouton déclencheur existe toujours,
    // on lui rend le focus immédiatement (WCAG 2.4.3).
    this.pendingCancel.set(null);
    this.focusTrigger();
  }

  protected confirmCancel(): void {
    const rental = this.pendingCancel();
    if (!rental || this.busy()) return;

    this.busy.set(true);
    this.admin.cancel(rental.id).subscribe({
      next: () => {
        this.items.update(list =>
          list.map(r => (r.id === rental.id ? { ...r, status: 'Cancelled' as const } : r)),
        );
        this.busy.set(false);
        this.pendingCancel.set(null);
        // Le bouton déclencheur disparaît (statut → Annulée) : focus sur le titre
        // APRÈS le rendu, sinon il se perdrait sur <body> (L-006).
        this.focusHeadingAfterRender();
        this.toast.show(
          $localize`:@@admin.rentals.toast.cancelled:Location annulée.`,
          'success',
        );
      },
      error: () => {
        // Échec : rien n'a changé, la ligne et son bouton restent → retour au déclencheur.
        this.busy.set(false);
        this.pendingCancel.set(null);
        this.focusTrigger();
        this.toast.show(
          $localize`:@@admin.rentals.toast.cancelError:L'annulation a échoué. Veuillez réessayer.`,
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
