import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import {
  ProductSummaryDto,
  resolveProductImage,
} from '../../core/models/product.model';

/**
 * Page Panier — AbrisTempo Local.
 * Pilotée par le CartService (signals items/count/subtotal). « Passer à la caisse »
 * dirige vers la page de paiement (démo). WCAG AA : h1 unique, contrôles libellés,
 * changements annoncés via live region.
 */
@Component({
  selector: 'app-cart',
  templateUrl: './cart.html',
  styleUrl: './cart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, RouterLink],
})
export class CartComponent {
  private readonly cart = inject(CartService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly items = this.cart.items;
  protected readonly count = this.cart.count;
  protected readonly subtotal = this.cart.subtotal;

  protected readonly announcement = signal('');
  /** Conservé pour compatibilité de gabarit (placeholder paiement non utilisé). */
  protected readonly checkoutOpen = signal(false);

  protected readonly isEmpty = computed(() => this.items().length === 0);

  protected imageOf(product: ProductSummaryDto): string {
    return resolveProductImage(product);
  }

  protected increase(product: ProductSummaryDto): void {
    this.cart.addItem(product, 1);
    this.announce(
      $localize`:@@cart.announce.increased:Quantité de ${product.name}:name: augmentée.`,
    );
  }

  protected decrease(product: ProductSummaryDto, quantity: number): void {
    if (quantity <= 1) {
      this.remove(product);
      return;
    }
    this.cart.removeItem(product.id);
    this.cart.addItem(product, quantity - 1);
    this.announce(
      $localize`:@@cart.announce.decreased:Quantité de ${product.name}:name: diminuée.`,
    );
  }

  protected remove(product: ProductSummaryDto): void {
    this.cart.removeItem(product.id);
    this.announce(
      $localize`:@@cart.announce.removed:${product.name}:name: retiré du panier.`,
    );
  }

  protected clear(): void {
    this.cart.clear();
    this.announce($localize`:@@cart.announce.cleared:Le panier a été vidé.`);
  }

  /** Dirige vers la caisse (paiement démo). Connexion requise pour commander. */
  protected checkout(): void {
    if (this.isEmpty()) return;
    if (!this.auth.isAuthenticated()) {
      this.toast.show(
        $localize`:@@cart.loginRequired:Connectez-vous pour passer une commande.`,
        'info',
      );
      this.router.navigateByUrl('/auth');
      return;
    }
    this.router.navigateByUrl('/panier/caisse');
  }

  private announce(message: string): void {
    this.announcement.set('');
    setTimeout(() => this.announcement.set(message), 60);
  }
}
