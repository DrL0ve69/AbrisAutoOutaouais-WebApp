import { describe, it, expect } from 'vitest';
import { CM_PER_FOOT, cmToFeet, feetToCm } from './units.util';

describe('units.util — conversion pieds ⇄ cm (cm canonique)', () => {
  it('feetToCm applique le facteur exact 30,48', () => {
    expect(feetToCm(1)).toBeCloseTo(30.48, 5);
    expect(feetToCm(10)).toBeCloseTo(304.8, 5);
    expect(feetToCm(0)).toBe(0);
  });

  it('cmToFeet est l’inverse de feetToCm', () => {
    expect(cmToFeet(CM_PER_FOOT)).toBeCloseTo(1, 5);
    // Les dimensions Tempo (cm) retombent ~sur des pieds entiers.
    expect(cmToFeet(335)).toBeCloseTo(10.99, 2); // abri simple ~11 pi
    expect(cmToFeet(610)).toBeCloseTo(20.01, 2); // abri double ~20 pi
  });

  it('round-trip pi → cm → pi préserve la valeur', () => {
    for (const ft of [3, 16.4, 19.7, 65]) {
      expect(cmToFeet(feetToCm(ft))).toBeCloseTo(ft, 5);
    }
  });
});
