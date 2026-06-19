import { Injectable, computed, signal } from '@angular/core';
import { ProductSummaryDto } from '../models/product.model';
// Import de TYPE uniquement : évite de tirer le composant configurateur (lazy) dans le
// bundle initial via ce service `providedIn: 'root'` (eager).
import type { ShelterConfiguration } from '../../features/shop/dimension-configurator/dimension-configurator';

/** Ligne PRODUIT du panier (article catalogue standard). Clé d'identité : `product.id`. */
export interface CartItem { readonly product: ProductSummaryDto; quantity: number; }

/**
 * Ligne ABRI CONFIGURÉ du panier (EPIC 9.4). Clé d'identité : COMPOSITE `slug + lengthCm`
 * (`shelterKey`) — deux configurations identiques fusionnent, et un retrait cible la bonne
 * ligne. Le `price` (DOLLARS) est issu du configurateur (endpoint serveur `/price` — source
 * unique L-004) et ne sert QU'À l'affichage ; la commande recalcule le montant serveur.
 */
export interface ShelterCartItem {
  /** Clé composite stable `slug + lengthCm` — fusion/retrait ciblé. */
  readonly key: string;
  readonly slug: string;
  readonly modelName: string;
  readonly lengthCm: number;
  /** Prix unitaire confirmé serveur (DOLLARS) — AFFICHAGE seulement (jamais transmis). */
  readonly price: number;
  quantity: number;
}

/** Clé composite d'un abri configuré : un même modèle à une même longueur fusionne. */
export function shelterKey(slug: string, lengthCm: number): string {
  return `${slug}|${lengthCm}`;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly _items = signal<CartItem[]>([]);
  private readonly _shelterItems = signal<ShelterCartItem[]>([]);

  readonly items = this._items.asReadonly();
  readonly shelterItems = this._shelterItems.asReadonly();

  /** Nombre total d'articles (produits + abris configurés). */
  readonly count = computed(
    () =>
      this._items().reduce((s, i) => s + i.quantity, 0) +
      this._shelterItems().reduce((s, i) => s + i.quantity, 0),
  );

  /** Sous-total d'affichage (produits + abris configurés). */
  readonly subtotal = computed(
    () =>
      this._items().reduce((s, i) => s + i.product.price * i.quantity, 0) +
      this._shelterItems().reduce((s, i) => s + i.price * i.quantity, 0),
  );

  addItem(product: ProductSummaryDto, qty = 1): void {
    this._items.update(items => {
      const existing = items.find(i => i.product.id === product.id);
      return existing
        ? items.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + qty } : i)
        : [...items, { product, quantity: qty }];
    });
  }

  removeItem(id: string): void { this._items.update(i => i.filter(x => x.product.id !== id)); }

  /**
   * Ajoute (ou fusionne) un abri configuré. La fusion se fait sur la clé composite
   * `slug + lengthCm` : une seconde configuration identique incrémente la quantité ;
   * le prix d'affichage est rafraîchi avec la dernière valeur serveur fournie.
   */
  addShelter(config: ShelterConfiguration, qty = 1): void {
    const key = shelterKey(config.slug, config.lengthCm);
    this._shelterItems.update(items => {
      const existing = items.find(i => i.key === key);
      return existing
        ? items.map(i =>
            i.key === key ? { ...i, quantity: i.quantity + qty, price: config.totalPrice } : i,
          )
        : [
            ...items,
            {
              key,
              slug: config.slug,
              modelName: config.modelName,
              lengthCm: config.lengthCm,
              price: config.totalPrice,
              quantity: qty,
            },
          ];
    });
  }

  /** Retire la ligne d'abri configuré dont la clé composite correspond. */
  removeShelter(key: string): void {
    this._shelterItems.update(i => i.filter(x => x.key !== key));
  }

  clear(): void {
    this._items.set([]);
    this._shelterItems.set([]);
  }
}
