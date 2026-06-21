import { describe, it, expect } from 'vitest';
import { footprintForVehiclesOriented } from './orientation.util';
import { footprintForVehicles } from './footprint.util';
import { CLEARANCE_PER_SIDE_CM } from './vehicle-dims.const';

describe('orientation.util — footprintForVehiclesOriented', () => {
  it('un seul véhicule : orientation sans effet', () => {
    const side = footprintForVehiclesOriented([{ type: 'berline', quantity: 1 }], 'side-by-side');
    const behind = footprintForVehiclesOriented([{ type: 'berline', quantity: 1 }], 'behind');
    // berline 190×480 + 2·60 → 310×600 dans les deux cas.
    expect(side).toMatchObject({ widthCm: 310, lengthCm: 600, outOfRange: false });
    expect(behind).toMatchObject({ widthCm: 310, lengthCm: 600, outOfRange: false });
  });

  it('côte à côte : largeurs additionnées, longueur = max + 2·dégagement', () => {
    const r = footprintForVehiclesOriented([{ type: 'berline', quantity: 2 }], 'side-by-side');
    // Σwidth = 380 ; + 60·3 = 180 → 560. length = 480 + 120 = 600.
    expect(r.widthCm).toBe(560);
    expect(r.lengthCm).toBe(600);
  });

  it('l’un derrière l’autre : longueurs additionnées, largeur = max + 2·dégagement', () => {
    const r = footprintForVehiclesOriented([{ type: 'berline', quantity: 2 }], 'behind');
    // length = Σlength 960 + 60·3 = 1140 ; width = max(190) + 120 = 310.
    expect(r.lengthCm).toBe(1140);
    expect(r.widthCm).toBe(310);
  });

  it('orientation « behind » donne un footprint DIFFÉRENT de « side-by-side » (longueurs additionnées)', () => {
    const side = footprintForVehiclesOriented([{ type: 'pickup', quantity: 2 }], 'side-by-side');
    const behind = footprintForVehiclesOriented([{ type: 'pickup', quantity: 2 }], 'behind');
    // En profondeur la longueur explose (Σ), la largeur se resserre (max).
    expect(behind.lengthCm).toBeGreaterThan(side.lengthCm);
    expect(behind.widthCm).toBeLessThan(side.widthCm);
  });

  it('réutilise CLEARANCE_PER_SIDE_CM (pas une nouvelle constante)', () => {
    expect(CLEARANCE_PER_SIDE_CM).toBe(60);
  });

  it('footprintForVehicles (API historique) == orientation « side-by-side »', () => {
    const legacy = footprintForVehicles([{ type: 'vus', quantity: 2 }]);
    const oriented = footprintForVehiclesOriented([{ type: 'vus', quantity: 2 }], 'side-by-side');
    expect(legacy).toEqual(oriented);
  });

  it('aucune sélection → hors plage', () => {
    expect(footprintForVehiclesOriented([], 'behind').outOfRange).toBe(true);
    expect(footprintForVehiclesOriented([{ type: 'berline', quantity: 0 }], 'behind').outOfRange).toBe(true);
  });
});
