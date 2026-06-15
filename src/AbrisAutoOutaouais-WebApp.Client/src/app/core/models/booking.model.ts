import { GuestContactRequest } from './guest-contact.model';

export type BookingType = 'Installation' | 'Delivery' | 'Removal';
export type BookingStatus = 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled';

export interface AddressDto {
  readonly civicNumber: string;
  readonly street: string;
  readonly apartment: string | null;
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
  /** Marque de l'abri à installer (optionnel ; ShelterLogic exclue côté serveur). */
  readonly brand?: string | null;
  /** Modèle de l'abri (optionnel). */
  readonly model?: string | null;
  /** Contact invité (Épic F) — rempli pour un visiteur non connecté, omis si connecté. */
  readonly guestContact?: GuestContactRequest | null;
}

/** Charge utile pour POST /bookings/{id}/reschedule — correspond au RescheduleBookingRequest C#. */
export interface RescheduleBookingRequest {
  readonly newSlotStart: string; // ISO 8601 (UTC) — la valeur `start` d'un AvailableSlotDto
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

/** Action de transition de statut acceptée par POST /bookings/{id}/status. */
export type BookingStatusAction = 'confirm' | 'complete' | 'cancel';

/** Réservation telle que vue par l'administration (GET /bookings/all). */
export interface AdminBookingDto {
  readonly id: string;
  readonly customerName: string;
  readonly customerEmail: string;
  readonly slotStart: string;
  readonly slotEnd: string;
  readonly type: BookingType;
  readonly status: BookingStatus;
  readonly addressSummary: string;
  readonly createdAt: string;
}
