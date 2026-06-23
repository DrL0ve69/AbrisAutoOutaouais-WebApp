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
  /**
   * Référence du virement Interac à réconcilier (EPIC 7). `null` pour les commandes
   * antérieures à e-Transfer. Miroir EXACT du C# `string? PaymentReference` (L-052).
   */
  readonly paymentReference: string | null;
  /**
   * Horodatage de confirmation du paiement (ISO). `null` tant que l'administration
   * n'a pas réconcilié le virement. Miroir du C# `DateTime? PaymentConfirmedAt` (L-052).
   */
  readonly paymentConfirmedAt: string | null;
}

/**
 * Instructions de paiement (virement Interac) renvoyées par POST /orders à la création.
 * Miroir EXACT du C# `PaymentInstructionsResult` (camelCase, sérialisation .NET) — L-052/L-004.
 */
export interface PaymentInstructions {
  /** Référence à inscrire dans le MESSAGE du virement Interac. */
  readonly reference: string;
  /** Courriel marchand vers lequel envoyer le virement. */
  readonly recipientEmail: string;
  /** Montant exact à virer. */
  readonly amount: number;
  /** Texte d'instructions (français) affiché au client. */
  readonly instructions: string;
}

/** Réponse de POST /orders : identifiant de la commande + instructions de paiement (EPIC 7). */
export interface PlaceOrderResponse {
  readonly id: string;
  readonly payment: PaymentInstructions;
}

export interface OrderLineRequest {
  readonly productId: string;
  readonly quantity: number;
}

/**
 * Ligne de commande d'un ABRI CONFIGURÉ (EPIC 9.4) — miroir EXACT du C#
 * `ShelterLineRequest(string Slug, int LengthCm, int ClearHeightCm, int Quantity)`
 * (Application/Orders/Commands/PlaceOrder). camelCase, sérialisation .NET.
 *
 * ⚠️ AUCUN champ prix : le serveur RECALCULE le montant via `ShelterPriceCalculator`
 * (source unique de vérité — L-004). Le prix affiché côté client (configurateur) ne sert
 * QU'À l'affichage ; il n'est jamais transmis dans la commande.
 *
 * La LARGEUR n'est pas transmise : elle est implicite au slug (« une largeur = un modèle », EPIC 9).
 * La HAUTEUR dégagée, elle, est un vrai choix client → transmise et validée serveur (∈ options du modèle).
 */
export interface ShelterLineRequest {
  readonly slug: string;
  readonly lengthCm: number;
  readonly clearHeightCm: number;
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
