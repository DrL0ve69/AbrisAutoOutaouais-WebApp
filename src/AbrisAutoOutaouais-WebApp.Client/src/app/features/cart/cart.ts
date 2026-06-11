import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import {
  ProductSummaryDto,
  resolveProductImage,
} from '../../core/models/product.model';

/**
 * Page Panier — AbrisTempo Local.
 * Entièrement pilotée par le CartService (signals items/count/subtotal).
 * WCAG AA : h1 unique, contrôles libellés, changements de quantité annoncés
 * via une live region (aria-live="polite"), état vide explicite.
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

  protected readonly items = this.cart.items;
  protected readonly count = this.cart.count;
  protected readonly subtotal = this.cart.subtotal;

  /** Annonce vocale du dernier changement de panier (live region). */
  protected readonly announcement = signal('');

  /** Affiche le placeholder « paiement bientôt disponible ». */
  protected readonly checkoutOpen = signal(false);

  protected readonly isEmpty = computed(() => this.items().length === 0);

  protected imageOf(product: ProductSummaryDto): string {
    return resolveProductImage(product);
  }

  /** Incrémente la quantité d'un article d'une unité. */
  protected increase(product: ProductSummaryDto): void {
    this.cart.addItem(product, 1);
    this.announce(
      $localize`:@@cart.announce.increased:Quantité de ${product.name}:name: augmentée.`,
    );
  }

  /**
   * Décrémente la quantité d'une unité. Si la quantité atteint zéro,
   * l'article est retiré du panier.
   */
  protected decrease(product: ProductSummaryDto, quantity: number): void {
    if (quantity <= 1) {
      this.remove(product);
      return;
    }
    // Pas de méthode dédiée dans le service : on retire puis on rajoute la
    // quantité diminuée pour conserver une seule source de vérité.
    this.cart.removeItem(product.id);
    this.cart.addItem(product, quantity - 1);
    this.announce(
      $localize`:@@cart.announce.decreased:Quantité de ${product.name}:name: diminuée.`,
    );
  }

  /** Retire complètement un article du panier. */
  protected remove(product: ProductSummaryDto): void {
    this.cart.removeItem(product.id);
    this.announce(
      $localize`:@@cart.announce.removed:${product.name}:name: retiré du panier.`,
    );
  }

  /** Vide entièrement le panier. */
  protected clear(): void {
    this.cart.clear();
    this.checkoutOpen.set(false);
    this.announce($localize`:@@cart.announce.cleared:Le panier a été vidé.`);
  }

  /** Affiche le message « paiement bientôt disponible » (Stripe à venir). */
  protected checkout(): void {
    this.checkoutOpen.set(true);
  }

  private announce(message: string): void {
    // On vide puis on repositionne le message pour forcer la relecture par
    // les lecteurs d'écran même si le texte est identique.
    this.announcement.set('');
    setTimeout(() => this.announcement.set(message), 60);
  }
}
