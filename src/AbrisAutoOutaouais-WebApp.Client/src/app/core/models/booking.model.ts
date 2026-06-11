export type BookingType = 'Installation' | 'Delivery' | 'Removal';
export type BookingStatus = 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled';

export interface AddressDto {
  readonly street: string;
  readonly city: string;
  readonly province: string;
  readonly postalCode: string;
  readonly country: string;
}

export interface AvailableSlotDto {
  readonly start: string; // ISO 8601 (UTC)
  readonly end: string;
}

/** Charge utile pour POST /bookings — correspond au CreateBookingCommand C#. */
export interface CreateBookingRequest {
  readonly slotStart: string; // ISO 8601 (UTC)
  readonly type: BookingType;
  readonly address: AddressDto;
  readonly notes?: string | null;
}

/** Correspond au BookingSummaryDto C# (GET /bookings/mine). */
export interface BookingSummaryDto {
  readonly id: string;
  readonly slotStart: string;
  readonly durationMin: number;
  readonly type: string;
  readonly status: string;
  readonly city: string;
}
