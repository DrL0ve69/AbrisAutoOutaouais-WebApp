import { GuestContactRequest } from './guest-contact.model';
import { PaymentInstructions } from './order.model';

export type BookingType = 'Installation' | 'Delivery' | 'Removal';
/**
 * `PendingPayment` (EPIC 7.3) : statut INITIAL d'une réservation tant que le virement Interac n'est
 * pas réconcilié par l'administration. La réservation passe `Confirmed` après confirmation du paiement.
 */
export type BookingStatus =
  | 'PendingPayment'
  | 'Pending'
  | 'Confirmed'
  | 'Completed'
  | 'Cancelled';

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
  /**
   * Client existant ciblé (calendrier admin, US-11.2). N'est HONORÉ par le serveur que si l'appelant
   * est Staff/Admin ; sinon ignoré en silence (repli). Mutuellement exclusif avec `guestContact`.
   */
  readonly targetCustomerId?: string | null;
}

/**
 * Réponse de POST /bookings (EPIC 7.3) : identifiant de la réservation créée + instructions de
 * paiement (virement Interac). Miroir du C# `CreateBookingResult(Guid BookingId, PaymentInstructionsResult Payment)`
 * — le contrôleur sérialise `{ id, payment }`. `PaymentInstructions` est RÉUTILISÉ depuis
 * `order.model.ts` (format canonique unique, pas de duplication — L-004).
 */
export interface CreateBookingResponse {
  readonly id: string;
  readonly payment: PaymentInstructions;
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
  /**
   * Référence du virement Interac à réconcilier (EPIC 7.3). `null` pour les réservations antérieures
   * à e-Transfer. Miroir EXACT du C# `string? PaymentReference` (L-052).
   */
  readonly paymentReference: string | null;
  /**
   * Horodatage de confirmation du paiement (ISO). `null` tant que l'administration n'a pas réconcilié
   * le virement. Miroir du C# `DateTime? PaymentConfirmedAt` (L-052).
   */
  readonly paymentConfirmedAt: string | null;
  /** Montant forfaitaire facturé (CAD). Miroir du C# `decimal Amount` (L-052). */
  readonly amount: number;
}
