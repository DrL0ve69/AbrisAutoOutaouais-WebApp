import { describe, it, expect } from 'vitest';
import { hhmmToMinutes, minutesToHhmm } from './work-hours.util';

describe('work-hours.util', () => {
  describe('minutesToHhmm', () => {
    it('formate les minutes en HH:mm avec zéro de tête', () => {
      expect(minutesToHhmm(0)).toBe('00:00');
      expect(minutesToHhmm(480)).toBe('08:00');
      expect(minutesToHhmm(1020)).toBe('17:00');
      expect(minutesToHhmm(1439)).toBe('23:59');
    });

    it('rend une chaîne vide pour null/undefined/hors plage', () => {
      expect(minutesToHhmm(null)).toBe('');
      expect(minutesToHhmm(undefined)).toBe('');
      expect(minutesToHhmm(-1)).toBe('');
      expect(minutesToHhmm(24 * 60)).toBe('');
      expect(minutesToHhmm(12.5)).toBe('');
    });
  });

  describe('hhmmToMinutes', () => {
    it('convertit HH:mm en minutes depuis minuit', () => {
      expect(hhmmToMinutes('00:00')).toBe(0);
      expect(hhmmToMinutes('08:00')).toBe(480);
      expect(hhmmToMinutes('17:00')).toBe(1020);
      expect(hhmmToMinutes('23:59')).toBe(1439);
    });

    it('rend null pour vide/invalide', () => {
      expect(hhmmToMinutes('')).toBeNull();
      expect(hhmmToMinutes(null)).toBeNull();
      expect(hhmmToMinutes(undefined)).toBeNull();
      expect(hhmmToMinutes('abc')).toBeNull();
      expect(hhmmToMinutes('24:00')).toBeNull();
      expect(hhmmToMinutes('12:60')).toBeNull();
    });

    it('est inverse de minutesToHhmm sur les valeurs valides', () => {
      for (const m of [0, 480, 1020, 1439]) {
        expect(hhmmToMinutes(minutesToHhmm(m))).toBe(m);
      }
    });
  });
});
