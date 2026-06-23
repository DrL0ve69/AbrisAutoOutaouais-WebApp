import { AddressDto } from './booking.model';
import { GuestContactRequest } from './guest-contact.model';

export type RentalStatus = 'Active' | 'Expired' | 'Cancelled';

/**
 * Charge utile pour POST /rentals — correspond au `CreateRentalContractCommand` C# (rework EPIC 9 :
 * location sur un MODÈLE paramétrique + taille configurée, plus sur un produit fixe). `slug` identifie
 * le modèle ; `lengthCm`/`clearHeightCm` la taille choisie (validée serveur contre la grille, 422 si
 * hors grille). Le tarif mensuel est forfaitaire et résolu côté serveur.
 */
export interface CreateRentalContractRequest {
  readonly slug: string;
  readonly lengthCm: number;
  readonly clearHeightCm: number;
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
