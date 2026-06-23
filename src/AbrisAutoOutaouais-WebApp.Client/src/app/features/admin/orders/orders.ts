import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminOrderService } from '../../../core/services/admin-order.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  AdminOrderDto,
  OrderStatus,
  OrderStatusAction,
} from '../../../core/models/order.model';

/** Action de statut affichable pour une commande (libellé + transition). */
interface StatusActionView {
  readonly action: OrderStatusAction;
  readonly label: string;
  readonly danger: boolean;
}

/**
 * Administration des commandes — liste accessible avec transitions de statut.
 * Accès protégé par authGuard + adminGuard (cf. app.routes.ts → /admin).
 * Les actions proposées dépendent du statut courant (machine à états côté API).
 * WCAG AA : table sémantique (caption, scope), badges décoratifs, boutons
 * d'action étiquetés avec la référence de la commande, messages via <output>.
 */
@Component({
  selector: 'app-admin-orders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CurrencyPipe, DatePipe],
  templateUrl: './orders.html',
  styleUrl: './orders.scss',
})
export class AdminOrdersComponent {
  private readonly admin = inject(AdminOrderService);
  private readonly toast = inject(ToastService);

  protected readonly items = signal<readonly AdminOrderDto[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  /** Id de la commande dont une transition est en cours (désactive ses boutons). */
  protected readonly pendingId = signal<string | null>(null);

  /**
   * Titre de page — cible de focus stable après une action qui retire le bouton déclencheur
   * (« Marquer payé » disparaît une fois la commande payée) : on rend le focus ici, pas au
   * bouton supprimé (L-006). Le `<h1>` porte `tabindex="-1"`.
   */
  private readonly heading = viewChild<ElementRef<HTMLElement>>('pageHeading');

  constructor() {
    this.loadOrders();
  }

  protected loadOrders(): void {
    this.loading.set(true);
    this.error.set(false);
    this.admin.getAllOrders().subscribe({
      next: orders => {
        this.items.set(orders);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
        this.toast.show(
          $localize`:@@admin.orders.toast.loadError:Échec du chargement des commandes.`,
          'error',
        );
      },
    });
  }

  /** Libellé français du statut, affiché dans le badge. */
  protected statusLabel(status: OrderStatus): string {
    switch (status) {
      case 'Pending':
        return $localize`:@@admin.orders.status.pending:En attente`;
      case 'Confirmed':
        return $localize`:@@admin.orders.status.confirmed:Confirmée`;
      case 'Shipped':
        return $localize`:@@admin.orders.status.shipped:Expédiée`;
      case 'Delivered':
        return $localize`:@@admin.orders.status.delivered:Livrée`;
      case 'Cancelled':
        return $localize`:@@admin.orders.status.cancelled:Annulée`;
    }
  }

  /** Suffixe de classe BEM pour la couleur du badge selon le statut. */
  protected statusModifier(status: OrderStatus): string {
    return status.toLowerCase();
  }

  /** Actions contextuelles disponibles pour le statut courant. */
  protected actionsFor(status: OrderStatus): readonly StatusActionView[] {
    switch (status) {
      case 'Pending':
        return [
          {
            action: 'confirm',
            label: $localize`:@@admin.orders.action.confirm:Confirmer`,
            danger: false,
          },
          {
            action: 'cancel',
            label: $localize`:@@admin.orders.action.cancel:Annuler`,
            danger: true,
          },
        ];
      case 'Confirmed':
        return [
          {
            action: 'ship',
            label: $localize`:@@admin.orders.action.ship:Expédier`,
            danger: false,
          },
          {
            action: 'cancel',
            label: $localize`:@@admin.orders.action.cancel:Annuler`,
            danger: true,
          },
        ];
      case 'Shipped':
        return [
          {
            action: 'deliver',
            label: $localize`:@@admin.orders.action.deliver:Marquer livrée`,
            danger: false,
          },
        ];
      case 'Delivered':
      case 'Cancelled':
        return [];
    }
  }

  protected updateStatus(order: AdminOrderDto, action: OrderStatusAction): void {
    this.pendingId.set(order.id);
    this.admin.updateStatus(order.id, action).subscribe({
      next: () => {
        this.pendingId.set(null);
        this.toast.show(
          $localize`:@@admin.orders.toast.updated:Statut de la commande mis à jour.`,
          'success',
        );
        this.loadOrders();
      },
      error: () => {
        this.pendingId.set(null);
        this.toast.show(
          $localize`:@@admin.orders.toast.updateError:La mise à jour du statut a échoué.`,
          'error',
        );
      },
    });
  }

  /**
   * Une commande est réconciliable (« Marquer payé ») si un virement est attaché
   * (`paymentReference` non nul), qu'il n'est pas déjà confirmé (`paymentConfirmedAt` nul) et que
   * la commande est encore « En attente » : seule une commande Pending peut être confirmée côté
   * serveur (`Order.MarkPaid` → `Confirm()` exige Pending, sinon 422). On n'affiche donc le bouton
   * que dans ce cas, pour ne jamais proposer une action qui échouerait.
   */
  protected canMarkPaid(order: AdminOrderDto): boolean {
    return (
      order.paymentReference !== null &&
      order.paymentConfirmedAt === null &&
      order.status === 'Pending'
    );
  }

  /** Libellé accessible du bouton « Marquer payé » — liaison dynamique → `$localize` (L-024). */
  protected markPaidLabel(reference: string): string {
    return $localize`:@@admin.orders.action.markPaidLabel:Marquer payé — ${reference}:ref:`;
  }

  /** Réconcilie le paiement (virement Interac reçu) puis recharge la liste (EPIC 7). */
  protected confirmPayment(order: AdminOrderDto): void {
    this.pendingId.set(order.id);
    this.admin.confirmPayment(order.id).subscribe({
      next: () => {
        this.pendingId.set(null);
        this.toast.show(
          $localize`:@@admin.orders.toast.paid:Paiement réconcilié — commande marquée payée.`,
          'success',
        );
        // Le bouton « Marquer payé » disparaît après rechargement : on rend le focus au titre
        // de la page (cible stable), pas au bouton supprimé (L-006).
        this.loadOrders();
        this.focusHeadingAfterRender();
      },
      error: () => {
        this.pendingId.set(null);
        this.toast.show(
          $localize`:@@admin.orders.toast.paidError:La réconciliation du paiement a échoué.`,
          'error',
        );
      },
    });
  }

  /** Focus du titre de page APRÈS le rendu suivant (le bouton déclencheur a disparu — L-006). */
  private focusHeadingAfterRender(): void {
    setTimeout(() => this.heading()?.nativeElement.focus());
  }
}
