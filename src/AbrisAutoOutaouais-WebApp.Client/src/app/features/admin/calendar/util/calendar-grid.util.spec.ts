import { describe, it, expect } from 'vitest';
import {
  addDays,
  addMonthsClamped,
  buildGrid,
  isGridNavKey,
  isoDate,
  nextGridDate,
  shiftPeriod,
  startOfMonth,
  startOfWeek,
  viewRange,
} from './calendar-grid.util';
import { CalendarBookingDto } from '../../../../core/models/calendar.model';

// Réservation utilitaire (un créneau dont le jour LOCAL est `isoLocalDay`).
function booking(id: string, isoUtc: string): CalendarBookingDto {
  return {
    id,
    slotStart: isoUtc,
    slotEnd: isoUtc,
    type: 'Installation',
    status: 'Pending',
    customerName: 'Client',
    city: 'Gatineau',
  };
}

describe('calendar-grid.util — clés & helpers de date', () => {
  it('isoDate produit YYYY-MM-DD du jour LOCAL', () => {
    expect(isoDate(new Date(2026, 6, 8))).toBe('2026-07-08'); // mois 0-indexé
    expect(isoDate(new Date(2026, 0, 1))).toBe('2026-01-01');
  });

  it('startOfWeek ramène au dimanche', () => {
    // 8 juillet 2026 = mercredi → dimanche 5 juillet.
    expect(isoDate(startOfWeek(new Date(2026, 6, 8)))).toBe('2026-07-05');
  });

  it('startOfMonth ramène au 1er du mois', () => {
    expect(isoDate(startOfMonth(new Date(2026, 6, 20)))).toBe('2026-07-01');
  });

  it('addMonthsClamped borne au dernier jour du mois cible (31 jan → 28/29 fév)', () => {
    expect(isoDate(addMonthsClamped(new Date(2026, 0, 31), 1))).toBe('2026-02-28');
    expect(isoDate(addMonthsClamped(new Date(2024, 0, 31), 1))).toBe('2024-02-29'); // bissextile
  });
});

describe('calendar-grid.util — viewRange (fenêtre backend)', () => {
  it('month couvre 6 semaines pleines (42 jours, dimanche → samedi)', () => {
    const { from, to } = viewRange('month', new Date(2026, 6, 15));
    expect(isoDate(from)).toBe('2026-06-28'); // dimanche avant le 1er juillet
    expect(isoDate(to)).toBe('2026-08-08'); // 41 jours plus tard
    expect((to.getTime() - from.getTime()) / 86_400_000).toBe(41);
  });

  it('week couvre dimanche → samedi', () => {
    const { from, to } = viewRange('week', new Date(2026, 6, 8));
    expect(isoDate(from)).toBe('2026-07-05');
    expect(isoDate(to)).toBe('2026-07-11');
  });

  it('day couvre le seul jour', () => {
    const { from, to } = viewRange('day', new Date(2026, 6, 8));
    expect(isoDate(from)).toBe('2026-07-08');
    expect(isoDate(to)).toBe('2026-07-08');
  });
});

describe('calendar-grid.util — buildGrid', () => {
  it('day → 1 cellule avec ses réservations', () => {
    const cells = buildGrid('day', new Date(2026, 6, 8), [booking('a', '2026-07-08T14:00:00Z')]);
    expect(cells).toHaveLength(1);
    expect(cells[0].isoDate).toBe('2026-07-08');
    expect(cells[0].inCurrentPeriod).toBe(true);
    expect(cells[0].bookings.map((b) => b.id)).toEqual(['a']);
  });

  it('week → 7 cellules, toutes dans la période', () => {
    const cells = buildGrid('week', new Date(2026, 6, 8), []);
    expect(cells).toHaveLength(7);
    expect(cells.every((c) => c.inCurrentPeriod)).toBe(true);
    expect(cells[0].isoDate).toBe('2026-07-05'); // dimanche
    expect(cells[6].isoDate).toBe('2026-07-11'); // samedi
  });

  it('month → 42 cellules ; inCurrentPeriod distingue le mois courant des débordements', () => {
    const cells = buildGrid('month', new Date(2026, 6, 15), []);
    expect(cells).toHaveLength(42);
    // 28-30 juin = débordement (faux), 1er juillet = mois courant (vrai).
    expect(cells[0].isoDate).toBe('2026-06-28');
    expect(cells[0].inCurrentPeriod).toBe(false);
    const july1 = cells.find((c) => c.isoDate === '2026-07-01')!;
    expect(july1.inCurrentPeriod).toBe(true);
  });

  it('rattache et trie chronologiquement les réservations du jour', () => {
    const cells = buildGrid('day', new Date(2026, 6, 8), [
      booking('late', '2026-07-08T16:00:00Z'),
      booking('early', '2026-07-08T08:00:00Z'),
    ]);
    expect(cells[0].bookings.map((b) => b.id)).toEqual(['early', 'late']);
  });
});

describe('calendar-grid.util — navigation clavier (pure)', () => {
  it('isGridNavKey ne reconnaît que les touches de navigation', () => {
    for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']) {
      expect(isGridNavKey(k)).toBe(true);
    }
    for (const k of ['Enter', ' ', 'Tab', 'a']) {
      expect(isGridNavKey(k)).toBe(false);
    }
  });

  it('month : ←/→ ±1 jour, ↑/↓ ±7 jours', () => {
    const d = new Date(2026, 6, 8); // mercredi 8 juillet
    expect(isoDate(nextGridDate('ArrowRight', d, 'month'))).toBe('2026-07-09');
    expect(isoDate(nextGridDate('ArrowLeft', d, 'month'))).toBe('2026-07-07');
    expect(isoDate(nextGridDate('ArrowDown', d, 'month'))).toBe('2026-07-15');
    expect(isoDate(nextGridDate('ArrowUp', d, 'month'))).toBe('2026-07-01');
  });

  it('month : Home/End = début/fin de semaine, PageUp/PageDown = mois ±1', () => {
    const d = new Date(2026, 6, 8);
    expect(isoDate(nextGridDate('Home', d, 'month'))).toBe('2026-07-05'); // dimanche
    expect(isoDate(nextGridDate('End', d, 'month'))).toBe('2026-07-11'); // samedi
    expect(isoDate(nextGridDate('PageDown', d, 'month'))).toBe('2026-08-08');
    expect(isoDate(nextGridDate('PageUp', d, 'month'))).toBe('2026-06-08');
  });

  it('week : ↑/↓ ±1 jour (pas ±7), PageUp/PageDown = semaine ±7', () => {
    const d = new Date(2026, 6, 8);
    expect(isoDate(nextGridDate('ArrowDown', d, 'week'))).toBe('2026-07-09');
    expect(isoDate(nextGridDate('ArrowUp', d, 'week'))).toBe('2026-07-07');
    expect(isoDate(nextGridDate('PageDown', d, 'week'))).toBe('2026-07-15');
    expect(isoDate(nextGridDate('PageUp', d, 'week'))).toBe('2026-07-01');
  });

  it('day : toutes les flèches ±1 jour, Home/End sans effet', () => {
    const d = new Date(2026, 6, 8);
    expect(isoDate(nextGridDate('ArrowRight', d, 'day'))).toBe('2026-07-09');
    expect(isoDate(nextGridDate('ArrowUp', d, 'day'))).toBe('2026-07-07');
    expect(isoDate(nextGridDate('Home', d, 'day'))).toBe('2026-07-08'); // inchangé
  });

  it('touche non gérée → date inchangée', () => {
    const d = new Date(2026, 6, 8);
    expect(isoDate(nextGridDate('Enter', d, 'month'))).toBe('2026-07-08');
  });
});

describe('calendar-grid.util — shiftPeriod (boutons Précédent/Suivant)', () => {
  it('month ±1 mois, week ±7 jours, day ±1 jour', () => {
    const d = new Date(2026, 6, 15);
    expect(isoDate(shiftPeriod('month', d, 1))).toBe('2026-08-15');
    expect(isoDate(shiftPeriod('month', d, -1))).toBe('2026-06-15');
    expect(isoDate(shiftPeriod('week', d, 1))).toBe('2026-07-22');
    expect(isoDate(shiftPeriod('day', d, -1))).toBe('2026-07-14');
  });

  it('addDays ne mute pas l’entrée', () => {
    const d = new Date(2026, 6, 8);
    addDays(d, 5);
    expect(isoDate(d)).toBe('2026-07-08');
  });
});
