import { BookingStatus, BookingType } from './booking.model';

/**
 * Réservation projetée pour une cellule de calendrier (vue planning, lecture seule).
 * Miroir EXACT du `CalendarBookingDto` C# (GET /bookings/calendar). Les bornes sont
 * des chaînes ISO 8601 en UTC. On réutilise `BookingType`/`BookingStatus` de booking.model.
 */
export interface CalendarBookingDto {
  readonly id: string;
  readonly slotStart: string; // ISO 8601 (UTC)
  readonly slotEnd: string; // ISO 8601 (UTC)
  readonly type: BookingType;
  readonly status: BookingStatus;
  readonly customerName: string;
  readonly city: string;
}

/** Granularité d'affichage du calendrier planning. */
export type CalendarView = 'month' | 'week' | 'day';

/**
 * Une cellule de la grille du calendrier (un jour). `inCurrentPeriod` est faux pour les
 * jours de débordement d'un mois (semaines complètes en tête/queue de grille mensuelle).
 */
export interface CalendarCell {
  /** Date du jour, normalisée à minuit local (clé `YYYY-MM-DD` via `isoDate`). */
  readonly date: Date;
  /** Clé ISO `YYYY-MM-DD` (jour local) — sert d'identité stable et de `track`. */
  readonly isoDate: string;
  /** Appartient à la période affichée (mois courant) ; faux pour les jours de débordement. */
  readonly inCurrentPeriod: boolean;
  /** Réservations dont le créneau débute ce jour-là (ordre chronologique). */
  readonly bookings: readonly CalendarBookingDto[];
}
