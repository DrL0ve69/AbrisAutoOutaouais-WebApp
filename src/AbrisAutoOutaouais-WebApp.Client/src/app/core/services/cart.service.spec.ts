import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { CartService, shelterKey } from './cart.service';
import { ShelterConfiguration } from '../../features/shop/dimension-configurator/dimension-configurator';
import { ProductSummaryDto } from '../models/product.model';

// ── État panier : abris CONFIGURÉS (EPIC 9.4-e) ──────────────────────────────────────────────
// On vérifie : (a) ajout/fusion par CLÉ COMPOSITE (slug + lengthCm), (b) `subtotal`/`count`
// incluent les abris en plus des produits, (c) `removeShelter` cible la bonne ligne. Les abris
// ne touchent JAMAIS l'état produit existant (non-régression du panier produit).

function makeProduct(id: string, price: number): ProductSummaryDto {
  return {
    id,
    name: `Produit ${id}`,
    slug: `produit-${id}`,
    price,
    rentalPrice: null,
    isAvailable: true,
    categoryName: 'Divers',
    thumbnailUrl: null,
  };
}

function makeConfig(over: Partial<ShelterConfiguration> = {}): ShelterConfiguration {
  return {
    slug: 'simple',
    modelName: 'Abri simple — Abris Tempo',
    widthCm: 335,
    clearHeightCm: 198,
    lengthCm: 366,
    archCount: 2,
    totalPrice: 549,
    ...over,
  };
}

describe('CartService — abris configurés (EPIC 9.4)', () => {
  let cart: CartService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    cart = TestBed.inject(CartService);
  });

  it('addShelter ajoute une nouvelle ligne avec sa clé composite', () => {
    cart.addShelter(makeConfig());

    expect(cart.shelterItems()).toHaveLength(1);
    const line = cart.shelterItems()[0];
    expect(line.key).toBe(shelterKey('simple', 366));
    expect(line.modelName).toBe('Abri simple — Abris Tempo');
    expect(line.lengthCm).toBe(366);
    expect(line.price).toBe(549);
    expect(line.quantity).toBe(1);
  });

  it('addShelter FUSIONNE deux configs identiques (même slug + lengthCm) en incrémentant la quantité', () => {
    cart.addShelter(makeConfig());
    cart.addShelter(makeConfig());

    expect(cart.shelterItems()).toHaveLength(1);
    expect(cart.shelterItems()[0].quantity).toBe(2);
  });

  it('addShelter crée des lignes DISTINCTES quand la longueur diffère (clé composite)', () => {
    cart.addShelter(makeConfig({ lengthCm: 366, totalPrice: 549 }));
    cart.addShelter(makeConfig({ lengthCm: 488, totalPrice: 749 }));

    expect(cart.shelterItems()).toHaveLength(2);
    expect(cart.shelterItems().map(i => i.lengthCm)).toEqual([366, 488]);
  });

  it('subtotal et count incluent les abris configurés EN PLUS des produits', () => {
    cart.addItem(makeProduct('p1', 100), 2); // 200 $, 2 articles
    cart.addShelter(makeConfig({ totalPrice: 549 }), 1); // 549 $, 1 article

    expect(cart.count()).toBe(3);
    expect(cart.subtotal()).toBe(749);
  });

  it('removeShelter cible la bonne ligne (clé composite) et laisse les autres', () => {
    cart.addShelter(makeConfig({ lengthCm: 366, totalPrice: 549 }));
    cart.addShelter(makeConfig({ lengthCm: 488, totalPrice: 749 }));

    cart.removeShelter(shelterKey('simple', 366));

    expect(cart.shelterItems()).toHaveLength(1);
    expect(cart.shelterItems()[0].lengthCm).toBe(488);
  });

  it('clear vide les produits ET les abris configurés', () => {
    cart.addItem(makeProduct('p1', 100));
    cart.addShelter(makeConfig());

    cart.clear();

    expect(cart.items()).toHaveLength(0);
    expect(cart.shelterItems()).toHaveLength(0);
    expect(cart.count()).toBe(0);
    expect(cart.subtotal()).toBe(0);
  });

  it('addShelter ne touche PAS l’état produit (non-régression panier produit)', () => {
    cart.addItem(makeProduct('p1', 100), 2);
    cart.addShelter(makeConfig());

    expect(cart.items()).toHaveLength(1);
    expect(cart.items()[0].quantity).toBe(2);
  });
});
