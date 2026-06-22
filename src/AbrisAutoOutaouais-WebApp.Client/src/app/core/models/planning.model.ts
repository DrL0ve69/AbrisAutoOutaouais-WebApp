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

/**
 * Un arrêt de la tournée optimisée (US-11.3) — miroir EXACT du `OptimizedStopDto` C#.
 * `slotStart` est une chaîne ISO 8601 (UTC brut) — le rendu se fait en fuseau LOCAL (L-044).
 * `legKm` = distance (km) depuis l'arrêt précédent (ou la base pour le premier).
 * `rescheduled` distingue les RDV effectivement recalés du surplus qui a gardé son heure.
 */
export interface OptimizedStop {
  readonly bookingId: string;
  readonly order: number;
  readonly slotStart: string; // ISO 8601 (UTC)
  readonly customerName: string;
  readonly city: string;
  readonly legKm: number;
  readonly rescheduled: boolean;
}

/**
 * Résultat de l'optimisation de tournée (US-11.3) — miroir EXACT du `OptimizeRouteResultDto` C#.
 * `date` est une chaîne ISO `YYYY-MM-DD`. `excludedBookingIds` liste les RDV sans coordonnées,
 * exclus de l'optimisation (pas de backfill). `totalKm` = distance totale de la tournée.
 */
export interface OptimizeRouteResult {
  readonly date: string;
  readonly stops: readonly OptimizedStop[];
  readonly excludedBookingIds: readonly string[];
  readonly totalKm: number;
}
