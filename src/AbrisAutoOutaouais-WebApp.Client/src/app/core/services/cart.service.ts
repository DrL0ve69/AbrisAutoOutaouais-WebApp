import { Injectable, computed, signal } from '@angular/core';
import { ProductSummaryDto } from '../models/product.model';

export interface CartItem { readonly product: ProductSummaryDto; quantity: number; }

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly _items = signal<CartItem[]>([]);

  readonly items = this._items.asReadonly();
  readonly count = computed(() => this._items().reduce((s, i) => s + i.quantity, 0));
  readonly subtotal = computed(() => this._items().reduce((s, i) => s + i.product.price * i.quantity, 0));

  addItem(product: ProductSummaryDto, qty = 1): void {
    this._items.update(items => {
      const existing = items.find(i => i.product.id === product.id);
      return existing
        ? items.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + qty } : i)
        : [...items, { product, quantity: qty }];
    });
  }

  removeItem(id: string): void { this._items.update(i => i.filter(x => x.product.id !== id)); }
  clear(): void { this._items.set([]); }
}
