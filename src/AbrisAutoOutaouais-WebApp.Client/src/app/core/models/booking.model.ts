export type BookingType = 'Installation' | 'Livraison' | 'Removal';
export type BookingStatus = 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled';

export interface AddressDto {
  readonly street: string;
  readonly city: string;
  readonly province: string;
  readonly postalCode: string;
  readonly country: string;
}

export interface AvailableSlotDto {
  readonly start: string;   // ISO 8601
  readonly end: string;
}

export interface CreateBookingRequest {
  slotStart: string;
  durationMin: number;
  type: BookingType;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  orderId?: string;
  notes?: string;
}
