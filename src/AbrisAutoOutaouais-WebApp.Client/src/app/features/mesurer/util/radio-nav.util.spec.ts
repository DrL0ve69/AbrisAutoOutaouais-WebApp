import { describe, it, expect } from 'vitest';
import { isRadioNavKey, nextRadioIndex } from './radio-nav.util';

describe('radio-nav.util — navigation APG d’un radiogroup', () => {
  it('isRadioNavKey ne reconnaît que les touches de navigation', () => {
    for (const k of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End']) {
      expect(isRadioNavKey(k)).toBe(true);
    }
    for (const k of ['Enter', ' ', 'Tab', 'a']) {
      expect(isRadioNavKey(k)).toBe(false);
    }
  });

  it('flèches avant/arrière avec bouclage sur 2 options', () => {
    expect(nextRadioIndex('ArrowRight', 0, 2)).toBe(1);
    expect(nextRadioIndex('ArrowDown', 0, 2)).toBe(1);
    expect(nextRadioIndex('ArrowRight', 1, 2)).toBe(0); // wrap
    expect(nextRadioIndex('ArrowLeft', 0, 2)).toBe(1); // wrap arrière
    expect(nextRadioIndex('ArrowUp', 1, 2)).toBe(0);
  });

  it('Home → première option, End → dernière', () => {
    expect(nextRadioIndex('Home', 2, 3)).toBe(0);
    expect(nextRadioIndex('End', 0, 3)).toBe(2);
  });

  it('touche non gérée ou groupe vide → index inchangé', () => {
    expect(nextRadioIndex('Enter', 1, 2)).toBe(1);
    expect(nextRadioIndex('ArrowRight', 0, 0)).toBe(0);
  });
});
