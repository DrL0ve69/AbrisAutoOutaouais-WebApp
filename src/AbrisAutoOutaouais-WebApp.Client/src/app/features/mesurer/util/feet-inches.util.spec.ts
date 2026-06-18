import { describe, it, expect } from 'vitest';
import { formatFeetInches } from './feet-inches.util';

describe('formatFeetInches', () => {
  it('335 cm → « 11 pi » (pouces nuls après arrondi, omis)', () => {
    // 335 / 30,48 = 10,99 pi → 131,9 po → 132 po = 11 pi 0 po → « 11 pi ».
    expect(formatFeetInches(335)).toBe('11 pi');
  });

  it('198 cm → « 6 pi 6 po »', () => {
    // 198 / 30,48 = 6,496 pi → 77,95 po → 78 po = 6 pi 6 po.
    expect(formatFeetInches(198)).toBe('6 pi 6 po');
  });

  it('arrondit au pouce le plus proche sans produire « 12 po »', () => {
    // 366 cm = 144,1 po → 144 po = 12 pi 0 po → « 12 pi » (pas « 11 pi 12 po »).
    expect(formatFeetInches(366)).toBe('12 pi');
  });

  it('décompose pieds + pouces pour une valeur intermédiaire', () => {
    // 244 cm = 96,06 po → 96 po = 8 pi 0 po.
    expect(formatFeetInches(244)).toBe('8 pi');
    // 213 cm = 83,86 po → 84 po = 7 pi 0 po.
    expect(formatFeetInches(213)).toBe('7 pi');
    // 229 cm = 90,2 po → 90 po = 7 pi 6 po.
    expect(formatFeetInches(229)).toBe('7 pi 6 po');
  });
});
