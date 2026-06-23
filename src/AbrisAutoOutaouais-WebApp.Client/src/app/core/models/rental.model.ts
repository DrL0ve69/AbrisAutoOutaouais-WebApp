import { AddressDto } from './booking.model';
import { GuestContactRequest } from './guest-contact.model';
import { PaymentInstructions } from './order.model';

/**
 * `PendingPayment` (EPIC 7.2) : statut INITIAL d'un contrat tant que le virement Interac n'est pas
 * réconcilié par l'administration. Le contrat passe `Active` après confirmation du paiement.
 */
export type RentalStatus = 'PendingPayment' | 'Active' | 'Expired' | 'Cancelled';

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

/**
 * Réponse de POST /rentals (EPIC 7.2) : identifiant du contrat créé + instructions de paiement
 * (virement Interac). Miroir du C# `CreateRentalContractResult(Guid RentalId, PaymentInstructionsResult Payment)`
 * — le contrôleur sérialise `{ id, payment }`. `PaymentInstructions` est RÉUTILISÉ depuis
 * `order.model.ts` (format canonique unique, pas de duplication — L-004).
 */
export interface CreateRentalContractResponse {
  readonly id: string;
  readonly payment: PaymentInstructions;
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
  /**
   * Référence du virement Interac à réconcilier (EPIC 7.2). `null` pour les contrats antérieurs à
   * e-Transfer. Miroir EXACT du C# `string? PaymentReference` (L-052).
   */
  readonly paymentReference: string | null;
  /**
   * Horodatage de confirmation du paiement (ISO). `null` tant que l'administration n'a pas réconcilié
   * le virement. Miroir du C# `DateTime? PaymentConfirmedAt` (L-052).
   */
  readonly paymentConfirmedAt: string | null;
}
