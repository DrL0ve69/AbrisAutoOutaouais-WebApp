import { GuestContactRequest } from './guest-contact.model';

export interface OrderSummaryDto {
  readonly id: string;
  readonly reference: string;
  readonly createdAt: string;
  readonly status: string;
  readonly total: number;
}

/** Statut d'une commande tel que renvoyé par l'API (string enum). */
export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled';

/** Action de transition de statut acceptée par POST /orders/{id}/status. */
export type OrderStatusAction = 'confirm' | 'ship' | 'deliver' | 'cancel';

/** Commande telle que vue par l'administration (GET /orders/all). */
export interface AdminOrderDto {
  readonly id: string;
  readonly reference: string;
  readonly customerEmail: string;
  readonly createdAt: string;
  readonly status: OrderStatus;
  readonly total: number;
  readonly itemCount: number;
}

export interface OrderLineRequest {
  readonly productId: string;
  readonly quantity: number;
}

/**
 * Ligne de commande d'un ABRI CONFIGURÉ (EPIC 9.4) — miroir EXACT du C#
 * `ShelterLineRequest(string Slug, int LengthCm, int Quantity)`
 * (Application/Orders/Commands/PlaceOrder). camelCase, sérialisation .NET.
 *
 * ⚠️ AUCUN champ prix : le serveur RECALCULE le montant via `ShelterPriceCalculator`
 * (source unique de vérité — L-004). Le prix affiché côté client (configurateur) ne sert
 * QU'À l'affichage ; il n'est jamais transmis dans la commande.
 */
export interface ShelterLineRequest {
  readonly slug: string;
  readonly lengthCm: number;
  readonly quantity: number;
}

export interface ShippingAddressRequest {
  readonly civicNumber: string;
  readonly street: string;
  readonly apartment: string | null;
  readonly city: string;
  readonly province: string;
  readonly postalCode: string;
  readonly country: string;
}

export type DeliveryType =
  | 'Pickup'
  | 'Delivery'
  | 'ExpressPickup'
  | 'ExpressDelivery';

export interface PlaceOrderRequest {
  readonly lines: readonly OrderLineRequest[];
  readonly deliveryType: DeliveryType;
  readonly shippingAddress: ShippingAddressRequest | null;
  /** Contact invité (Épic F) — rempli pour un visiteur non connecté, omis si connecté. */
  readonly guestContact?: GuestContactRequest | null;
  /** Lignes d'abris CONFIGURÉS (EPIC 9.4) — omises si le panier n'en contient aucun. */
  readonly shelterLines?: readonly ShelterLineRequest[];
}
