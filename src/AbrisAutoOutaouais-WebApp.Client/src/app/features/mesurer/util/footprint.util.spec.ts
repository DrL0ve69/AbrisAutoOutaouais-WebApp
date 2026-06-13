import { describe, it, expect } from 'vitest';
import {
  FOOTPRINT_MAX_CM,
  footprintForVehicles,
  footprintFromManual,
} from './footprint.util';
import { CLEARANCE_PER_SIDE_CM, VEHICLE_DIMS } from './vehicle-dims.const';

describe('footprint.util', () => {
  describe('footprintForVehicles — un seul véhicule', () => {
    it('berline seule : dimensions + 2·dégagement de chaque côté', () => {
      const { widthCm, lengthCm, outOfRange } = footprintForVehicles([
        { type: 'berline', quantity: 1 },
      ]);
      // berline 190×480, dégagement 60 → 190+120=310 ; 480+120=600.
      expect(widthCm).toBe(VEHICLE_DIMS.berline.widthCm + 2 * CLEARANCE_PER_SIDE_CM);
      expect(lengthCm).toBe(VEHICLE_DIMS.berline.lengthCm + 2 * CLEARANCE_PER_SIDE_CM);
      expect(widthCm).toBe(310);
      expect(lengthCm).toBe(600);
      expect(outOfRange).toBe(false);
    });

    it('pickup seul (gabarit spec F-150 670×203)', () => {
      const { widthCm, lengthCm, outOfRange } = footprintForVehicles([
        { type: 'pickup', quantity: 1 },
      ]);
      expect(widthCm).toBe(203 + 120); // 323
      expect(lengthCm).toBe(670 + 120); // 790
      expect(outOfRange).toBe(false);
    });
  });

  describe('footprintForVehicles — plusieurs véhicules (côte à côte)', () => {
    it('deux berlines : largeurs additionnées + dégagement entre/autour, longueur = max + 2·dégagement', () => {
      const { widthCm, lengthCm, outOfRange } = footprintForVehicles([
        { type: 'berline', quantity: 2 },
      ]);
      // Σwidth = 190·2 = 380 ; + 60·(2+1)=180 → 560. length = 480 + 120 = 600.
      expect(widthCm).toBe(380 + 180);
      expect(lengthCm).toBe(480 + 120);
      expect(outOfRange).toBe(false);
    });

    it('mélange types/quantités (berline + pickup) : longueur dominée par le plus long', () => {
      const { widthCm, lengthCm } = footprintForVehicles([
        { type: 'berline', quantity: 1 },
        { type: 'pickup', quantity: 1 },
      ]);
      // Σwidth = 190 + 203 = 393 ; + 60·3 = 180 → 573. length = max(480, 670) + 120 = 790.
      expect(widthCm).toBe(393 + 180);
      expect(lengthCm).toBe(670 + 120);
    });
  });

  describe('footprintForVehicles — cas limites', () => {
    it('aucune sélection → hors plage, pas d’appel D2', () => {
      expect(footprintForVehicles([]).outOfRange).toBe(true);
      expect(footprintForVehicles([{ type: 'berline', quantity: 0 }]).outOfRange).toBe(true);
    });

    it('quantité énorme → dépasse 2000 cm → hors plage', () => {
      const r = footprintForVehicles([{ type: 'pickup', quantity: 10 }]);
      // Σwidth = 2030 + 60·11 = 2690 → > 2000.
      expect(r.outOfRange).toBe(true);
    });
  });

  describe('footprintFromManual', () => {
    it('passe-through avec arrondi au cm supérieur (jamais sous-dimensionner)', () => {
      const r = footprintFromManual(300.2, 599.9);
      expect(r.widthCm).toBe(301);
      expect(r.lengthCm).toBe(600);
      expect(r.outOfRange).toBe(false);
    });

    it('valeur > 2000 → hors plage', () => {
      const r = footprintFromManual(2500, 600);
      expect(r.outOfRange).toBe(true);
    });

    it('exactement 2000 reste dans la plage', () => {
      const r = footprintFromManual(FOOTPRINT_MAX_CM, FOOTPRINT_MAX_CM);
      expect(r.outOfRange).toBe(false);
    });

    it('valeur ≤ 0 / non finie → hors plage', () => {
      expect(footprintFromManual(0, 500).outOfRange).toBe(true);
      expect(footprintFromManual(-5, 500).outOfRange).toBe(true);
      expect(footprintFromManual(NaN, 500).outOfRange).toBe(true);
    });
  });
});
