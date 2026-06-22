/**
 * Logique PURE et testable de la grille du calendrier planning (mois/semaine/jour) et de
 * l'arithmétique de navigation clavier (flèches/Home/End/PageUp/PageDown). Aucun accès au DOM
 * ni à des signaux : le composant calcule les cellules et la date active suivante ici, puis
 * déplace le focus lui-même (pattern grid APG — roving tabindex).
 *
 * Convention : toutes les dates représentent un JOUR LOCAL normalisé à minuit. La clé ISO
 * `YYYY-MM-DD` (jour local) sert d'identité stable (track) et de regroupement des réservations.
 * Semaine débutant le DIMANCHE (convention nord-américaine).
 */
import { CalendarBookingDto, CalendarCell, CalendarView } from '../../../../core/models/calendar.model';

/** Touches de navigation d'une grille de calendrier APG (les autres sont ignorées). */
export const GRID_NAV_KEYS = [
  'ArrowRight',
  'ArrowLeft',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
];

/** Vrai si la touche pilote la grille (et doit voir son comportement par défaut neutralisé). */
export function isGridNavKey(key: string): boolean {
  return GRID_NAV_KEYS.includes(key);
}

/** Normalise une date à minuit (jour local), sans muter l'entrée. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Ajoute `days` jours (peut être négatif) à un jour local, sans muter l'entrée. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Clé ISO `YYYY-MM-DD` d'un jour LOCAL (pas d'UTC — évite le décalage de fuseau). */
export function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Vrai si les deux dates tombent le même jour local. */
export function isSameDay(a: Date, b: Date): boolean {
  return isoDate(a) === isoDate(b);
}

/** Premier jour (dimanche) de la semaine contenant `date`. */
export function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  return addDays(d, -d.getDay()); // getDay(): 0 = dimanche
}

/** Premier jour du mois de `date`. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Borne [from, to] (jours locaux inclus) couverte par une vue, pour la requête au backend.
 * - month : la grille complète (semaines débordantes incluses) → couvre l'affichage réel.
 * - week  : dimanche → samedi.
 * - day   : le jour seul.
 */
export function viewRange(view: CalendarView, anchor: Date): { from: Date; to: Date } {
  switch (view) {
    case 'month': {
      const first = startOfWeek(startOfMonth(anchor));
      return { from: first, to: addDays(first, 41) }; // 6 semaines × 7 jours - 1
    }
    case 'week': {
      const first = startOfWeek(anchor);
      return { from: first, to: addDays(first, 6) };
    }
    case 'day': {
      const d = startOfDay(anchor);
      return { from: d, to: d };
    }
  }
}

/** Regroupe les réservations par clé de jour local (selon leur `slotStart`). */
function groupByDay(bookings: readonly CalendarBookingDto[]): Map<string, CalendarBookingDto[]> {
  const map = new Map<string, CalendarBookingDto[]>();
  for (const b of bookings) {
    const key = isoDate(new Date(b.slotStart));
    const list = map.get(key);
    if (list) {
      list.push(b);
    } else {
      map.set(key, [b]);
    }
  }
  // Tri chronologique intra-journée (stable, lecture seule).
  for (const list of map.values()) {
    list.sort((x, y) => x.slotStart.localeCompare(y.slotStart));
  }
  return map;
}

/** Construit une cellule pour un jour donné, en y rattachant ses réservations. */
function toCell(
  date: Date,
  inCurrentPeriod: boolean,
  byDay: Map<string, CalendarBookingDto[]>,
): CalendarCell {
  const key = isoDate(date);
  return { date, isoDate: key, inCurrentPeriod, bookings: byDay.get(key) ?? [] };
}

/**
 * Génère les cellules de la grille pour la vue et la date d'ancrage données.
 * - month : 42 cellules (6 semaines pleines) ; `inCurrentPeriod` distingue le mois courant.
 * - week  : 7 cellules (dimanche → samedi), toutes dans la période.
 * - day   : 1 cellule.
 */
export function buildGrid(
  view: CalendarView,
  anchor: Date,
  bookings: readonly CalendarBookingDto[],
): CalendarCell[] {
  const byDay = groupByDay(bookings);

  if (view === 'day') {
    return [toCell(startOfDay(anchor), true, byDay)];
  }

  if (view === 'week') {
    const first = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => toCell(addDays(first, i), true, byDay));
  }

  // month
  const month = anchor.getMonth();
  const first = startOfWeek(startOfMonth(anchor));
  return Array.from({ length: 42 }, (_, i) => {
    const d = addDays(first, i);
    return toCell(d, d.getMonth() === month, byDay);
  });
}

/**
 * Date sélectionnée suivante pour la touche pressée, à partir de la date active courante.
 * Pas de bornage à la période : déplacer hors période fait défiler (le composant ré-ancre).
 * - month : ←/→ ±1 jour ; ↑/↓ ±7 jours ; Home/End = début/fin de semaine ;
 *           PageUp/PageDown = mois précédent/suivant (même quantième, borné à la fin du mois).
 * - week  : ←/→ ±1 jour ; ↑/↓ ±1 jour ; Home/End = début/fin de semaine ;
 *           PageUp/PageDown = semaine précédente/suivante.
 * - day   : ←/→/↑/↓/PageUp/PageDown ±1 jour ; Home/End sans effet (un seul jour).
 * Une touche non gérée renvoie la date inchangée.
 */
export function nextGridDate(
  key: string,
  current: Date,
  view: CalendarView,
): Date {
  const d = startOfDay(current);

  if (view === 'day') {
    switch (key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case 'PageDown':
        return addDays(d, 1);
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
        return addDays(d, -1);
      default:
        return d;
    }
  }

  if (view === 'week') {
    switch (key) {
      case 'ArrowRight':
      case 'ArrowDown':
        return addDays(d, 1);
      case 'ArrowLeft':
      case 'ArrowUp':
        return addDays(d, -1);
      case 'Home':
        return startOfWeek(d);
      case 'End':
        return addDays(startOfWeek(d), 6);
      case 'PageDown':
        return addDays(d, 7);
      case 'PageUp':
        return addDays(d, -7);
      default:
        return d;
    }
  }

  // month
  switch (key) {
    case 'ArrowRight':
      return addDays(d, 1);
    case 'ArrowLeft':
      return addDays(d, -1);
    case 'ArrowDown':
      return addDays(d, 7);
    case 'ArrowUp':
      return addDays(d, -7);
    case 'Home':
      return startOfWeek(d);
    case 'End':
      return addDays(startOfWeek(d), 6);
    case 'PageDown':
      return addMonthsClamped(d, 1);
    case 'PageUp':
      return addMonthsClamped(d, -1);
    default:
      return d;
  }
}

/** Décale de `months` mois en conservant le quantième, borné au dernier jour du mois cible. */
export function addMonthsClamped(date: Date, months: number): Date {
  const targetMonthFirst = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(
    targetMonthFirst.getFullYear(),
    targetMonthFirst.getMonth() + 1,
    0,
  ).getDate();
  const day = Math.min(date.getDate(), lastDay);
  return new Date(targetMonthFirst.getFullYear(), targetMonthFirst.getMonth(), day);
}

/** Nouvelle date d'ancrage après navigation de période (boutons Précédent/Suivant). */
export function shiftPeriod(view: CalendarView, anchor: Date, direction: -1 | 1): Date {
  switch (view) {
    case 'month':
      return addMonthsClamped(anchor, direction);
    case 'week':
      return addDays(anchor, 7 * direction);
    case 'day':
      return addDays(anchor, direction);
  }
}
