export interface OrderSummaryDto {
  readonly id: string;
  readonly reference: string;
  readonly createdAt: string;
  readonly status: string;
  readonly total: number;
}

export interface OrderLineRequest {
  readonly productId: string;
  readonly quantity: number;
}

export interface ShippingAddressRequest {
  readonly street: string;
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
