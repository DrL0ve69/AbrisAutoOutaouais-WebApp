import { describe, expect, it } from 'vitest';
import { rectDimensionsFromPolygon } from './measure-rect.util';

/**
 * L-034 — un cas ALIGNÉ AUX AXES ne peut PAS attraper la régression de la bbox : il faut un
 * rectangle PIVOTÉ. La bbox alignée gonflerait un 3×6 pivoté à 45° en ~6,4×6,4 ; la mesure
 * par arête doit rendre ~3×6 quelle que soit l'orientation.
 */

// Centre de référence proche de Gatineau (où la carte retombe par défaut).
const CENTER_LAT = 45.48;
const CENTER_LNG = -75.7;

const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LNG = 111_320 * Math.cos((CENTER_LAT * Math.PI) / 180);

/** Convertit un offset local en mètres (est, nord) en position GeoJSON [lng, lat]. */
function offsetToLngLat(eastM: number, northM: number): [number, number] {
  return [CENTER_LNG + eastM / M_PER_DEG_LNG, CENTER_LAT + northM / M_PER_DEG_LAT];
}

/** Applique une rotation de `deg` degrés à un offset local (est, nord) en mètres. */
function rotate(eastM: number, northM: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [eastM * cos - northM * sin, eastM * sin + northM * cos];
}

/**
 * Construit un Feature Polygon GeoJSON pour un rectangle de `widthM` (axe est) × `lengthM`
 * (axe nord), centré sur (CENTER_LAT, CENTER_LNG), pivoté de `rotationDeg`.
 * Anneau fermé (1er sommet répété en dernier) comme le produit geoman/Leaflet.
 */
function makeRectPolygon(widthM: number, lengthM: number, rotationDeg = 0): unknown {
  const halfW = widthM / 2;
  const halfL = lengthM / 2;
  // Sommets locaux (est, nord) : coin SO, SE, NE, NO.
  const corners: readonly [number, number][] = [
    [-halfW, -halfL],
    [halfW, -halfL],
    [halfW, halfL],
    [-halfW, halfL],
  ];
  const ring = corners.map(([e, n]) => {
    const [re, rn] = rotate(e, n, rotationDeg);
    return offsetToLngLat(re, rn);
  });
  ring.push(ring[0]); // fermeture de l'anneau
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [ring] },
    properties: {},
  };
}

describe('rectDimensionsFromPolygon', () => {
  it('(a) rectangle aligné aux axes ~3×6 m → largeur≈3, longueur≈6', () => {
    const dims = rectDimensionsFromPolygon(makeRectPolygon(3, 6, 0));
    expect(dims).not.toBeNull();
    expect(dims!.widthM).toBeCloseTo(3, 1);
    expect(dims!.lengthM).toBeCloseTo(6, 1);
  });

  it('(b) rectangle PIVOTÉ 45°, 3×6 m → largeur≈3, longueur≈6 (PAS ~6,4×6,4 comme la bbox)', () => {
    const dims = rectDimensionsFromPolygon(makeRectPolygon(3, 6, 45));
    expect(dims).not.toBeNull();
    // Mesure par arête : invariante à l'orientation.
    expect(dims!.widthM).toBeCloseTo(3, 1);
    expect(dims!.lengthM).toBeCloseTo(6, 1);
    // Preuve anti-régression L-034 : la bbox alignée donnerait ~6,4 sur les deux axes.
    expect(dims!.widthM).toBeLessThan(4);
    expect(dims!.lengthM).toBeLessThan(7);
    expect(dims!.lengthM).toBeGreaterThan(5);
  });

  it('(c) carré ~4×4 m → largeur≈4, longueur≈4', () => {
    const dims = rectDimensionsFromPolygon(makeRectPolygon(4, 4, 30));
    expect(dims).not.toBeNull();
    expect(dims!.widthM).toBeCloseTo(4, 1);
    expect(dims!.lengthM).toBeCloseTo(4, 1);
  });

  it('(d) polygone à ≠4 sommets (triangle) → null', () => {
    const t1 = offsetToLngLat(0, 5);
    const t2 = offsetToLngLat(5, -5);
    const t3 = offsetToLngLat(-5, -5);
    const triangle = {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[t1, t2, t3, t1]] },
      properties: {},
    };
    expect(rectDimensionsFromPolygon(triangle)).toBeNull();

    const p = [
      offsetToLngLat(0, 6),
      offsetToLngLat(6, 2),
      offsetToLngLat(4, -6),
      offsetToLngLat(-4, -6),
      offsetToLngLat(-6, 2),
    ];
    const pentagon = {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[...p, p[0]]] },
      properties: {},
    };
    expect(rectDimensionsFromPolygon(pentagon)).toBeNull();
  });

  it('(e) sommets coïncidents (dégénéré) → null', () => {
    const samePoint = offsetToLngLat(0, 0);
    const other = offsetToLngLat(3, 0);
    // 4 sommets distincts en apparence mais deux coïncident → arête ~0.
    const degenerate = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[samePoint, samePoint, other, offsetToLngLat(3, 6), samePoint]],
      },
      properties: {},
    };
    expect(rectDimensionsFromPolygon(degenerate)).toBeNull();
  });

  it('accepte aussi une Geometry Polygon nue (sans wrapper Feature)', () => {
    const feature = makeRectPolygon(3, 6, 20) as { geometry: unknown };
    const dims = rectDimensionsFromPolygon(feature.geometry);
    expect(dims).not.toBeNull();
    expect(dims!.widthM).toBeCloseTo(3, 1);
    expect(dims!.lengthM).toBeCloseTo(6, 1);
  });

  it('entrée non-polygone → null', () => {
    expect(rectDimensionsFromPolygon(null)).toBeNull();
    expect(rectDimensionsFromPolygon({ type: 'Point', coordinates: [0, 0] })).toBeNull();
    expect(rectDimensionsFromPolygon('nope')).toBeNull();
  });
});
