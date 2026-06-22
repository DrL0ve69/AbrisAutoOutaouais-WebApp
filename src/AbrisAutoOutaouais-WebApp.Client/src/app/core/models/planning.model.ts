import { CalendarBookingDto } from './calendar.model';

/**
 * Heures d'un employé (rôle Staff) pour un jour — miroir EXACT du `StaffWorkHoursDto` C#.
 * `startMinutes`/`endMinutes` sont des minutes depuis minuit en fuseau LOCAL (jamais UTC — L-044).
 * `hasEntry` distingue « aucune ligne » (n'a pas travaillé) d'une ligne aux heures nulles.
 */
export interface StaffWorkHoursDto {
  readonly employeeId: string;
  readonly fullName: string;
  readonly startMinutes: number | null;
  readonly endMinutes: number | null;
  readonly note: string | null;
  readonly hasEntry: boolean;
}

/**
 * Détail d'une journée du planning (US-11.2) — miroir EXACT du `DayDetailDto` C#.
 * `date` est une chaîne ISO `YYYY-MM-DD` (DateOnly sérialisé). Réutilise `CalendarBookingDto`.
 */
export interface DayDetailDto {
  readonly date: string;
  readonly bookings: readonly CalendarBookingDto[];
  readonly staff: readonly StaffWorkHoursDto[];
}

/**
 * Corps de la requête PUT /planning/work-hours — miroir EXACT du `UpsertWorkHoursCommand` C#.
 * Les minutes nulles sont valides (« présent, horaire non précisé »).
 */
export interface UpsertWorkHoursRequest {
  readonly employeeId: string;
  readonly date: string; // YYYY-MM-DD
  readonly startMinutes: number | null;
  readonly endMinutes: number | null;
  readonly note: string | null;
}

/**
 * Résultat de recherche d'un client (US-11.2 : ajout d'un RDV depuis le calendrier admin) —
 * miroir EXACT du `CustomerSearchResultDto` C# (GET /planning/customers?term=). `id` est l'identité
 * opaque à envoyer en `targetCustomerId` (jamais une recherche inverse par nom — L-036).
 */
export interface CustomerSearchResult {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}
