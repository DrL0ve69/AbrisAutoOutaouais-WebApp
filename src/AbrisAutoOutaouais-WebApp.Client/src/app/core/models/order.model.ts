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
}
