import { describe, it, expect } from 'vitest';
import { buildShelterDescriptor } from './shelter-model.builder';

// Spec DÉTERMINISTE : on n'exerce QUE `buildShelterDescriptor` (pure, sans `three`/WebGL).
// `descriptorToGroup` n'est jamais appelée ici (elle exigerait le namespace three).

describe('buildShelterDescriptor', () => {
  const dims = { widthCm: 400, lengthCm: 600, heightCm: 250 };

  it('calcule unitScale (cm → mètres par défaut)', () => {
    const d = buildShelterDescriptor(dims);
    expect(d.unitScale).toBeCloseTo(0.01, 10); // 1 / 100
  });

  it("compte les arcs = ceil(longueur / espacement) + 1, répartis symétriquement autour de 0", () => {
    const baySpacingCm = 120;
    const d = buildShelterDescriptor(dims, { baySpacingCm });
    const bays = Math.ceil(600 / baySpacingCm); // 5
    expect(d.arcs).toHaveLength(bays + 1); // 6 arcs

    const zs = d.arcs.map(a => a.z);
    // Premier et dernier symétriques autour de 0 (z ∈ [-L/2, +L/2]).
    const length = 600 * 0.01; // 6 unités
    expect(zs[0]).toBeCloseTo(-length / 2, 10);
    expect(zs[zs.length - 1]).toBeCloseTo(length / 2, 10);
    // Somme des z ≈ 0 (répartition symétrique).
    const sum = zs.reduce((acc, z) => acc + z, 0);
    expect(sum).toBeCloseTo(0, 6);
  });

  it('utilise radiusX = (largeur/2)·unitScale et radiusY = hauteur·unitScale', () => {
    const d = buildShelterDescriptor(dims);
    expect(d.arcs[0].radiusX).toBeCloseTo((400 / 2) * 0.01, 10); // 2.0
    expect(d.arcs[0].radiusY).toBeCloseTo(250 * 0.01, 10); // 2.5
    expect(d.cloth.radiusX).toBeCloseTo(2.0, 10);
    expect(d.cloth.radiusY).toBeCloseTo(2.5, 10);
  });

  it('produit des bounds cohérents avec les dimensions', () => {
    const d = buildShelterDescriptor(dims);
    expect(d.bounds.width).toBeCloseTo(4.0, 10); // 2·radiusX
    expect(d.bounds.height).toBeCloseTo(2.5, 10);
    expect(d.bounds.length).toBeCloseTo(6.0, 10);
    expect(d.bounds.radius).toBeGreaterThan(0);
    // Le rayon englobant couvre au moins la demi-longueur.
    expect(d.bounds.radius).toBeGreaterThanOrEqual(d.bounds.length / 2);
  });

  it('respecte la couleur de toile passée en option', () => {
    const d = buildShelterDescriptor(dims, { clothColor: '#abcdef' });
    expect(d.cloth.color).toBe('#abcdef');
  });

  it('gère des dimensions dégénérées (0 / négatives) sans NaN ni rayon nul', () => {
    const d = buildShelterDescriptor({ widthCm: 0, lengthCm: -50, heightCm: 0 });
    expect(d.arcs.length).toBeGreaterThanOrEqual(2);
    for (const arc of d.arcs) {
      expect(Number.isFinite(arc.z)).toBe(true);
      expect(arc.radiusX).toBeGreaterThan(0);
      expect(arc.radiusY).toBeGreaterThan(0);
    }
    expect(Number.isFinite(d.bounds.radius)).toBe(true);
    expect(d.bounds.radius).toBeGreaterThan(0);
  });

  it('pose une panne au faîte (angle π/2) et aux côtés (0, π)', () => {
    const d = buildShelterDescriptor(dims);
    const angles = d.purlins.map(p => p.angle);
    expect(angles).toContain(0);
    expect(angles).toContain(Math.PI / 2);
    expect(angles).toContain(Math.PI);
    // La panne de faîte est au sommet : y ≈ radiusY, x ≈ 0.
    const ridge = d.purlins.find(p => p.angle === Math.PI / 2)!;
    expect(ridge.x).toBeCloseTo(0, 10);
    expect(ridge.y).toBeCloseTo(2.5, 10);
  });
});
