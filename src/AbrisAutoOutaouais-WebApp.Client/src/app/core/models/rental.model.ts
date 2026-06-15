import { AddressDto } from './booking.model';
import { GuestContactRequest } from './guest-contact.model';

export type RentalStatus = 'Active' | 'Expired' | 'Cancelled';

/** Charge utile pour POST /rentals — correspond au CreateRentalContractCommand C#. */
export interface CreateRentalContractRequest {
  readonly productId: string;
  readonly startDate: string; // ISO date (yyyy-MM-dd)
  readonly endDate: string;
  readonly address: AddressDto;
  /** Contact invité (Épic F) — rempli pour un visiteur non connecté, omis si connecté. */
  readonly guestContact?: GuestContactRequest | null;
}

/** Correspond au RentalSummaryDto C# (GET /rentals/mine). */
export interface RentalSummaryDto {
  readonly id: string;
  readonly productName: string;
  readonly monthlyRate: number;
  readonly startDate: string; // yyyy-MM-dd
  readonly endDate: string;
  readonly status: string;
}

/** Contrat de location tel que vu par l'administration (GET /rentals/all). */
export interface AdminRentalDto {
  readonly id: string;
  readonly customerName: string;
  readonly customerEmail: string;
  readonly productName: string;
  readonly monthlyRate: number;
  readonly startDate: string; // yyyy-MM-dd
  readonly endDate: string;
  readonly status: RentalStatus;
  readonly addressSummary: string;
  readonly createdAt: string;
}
