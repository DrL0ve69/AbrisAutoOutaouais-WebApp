import { describe, expect, it } from 'vitest';
import {
  SERVICE_BASE,
  SERVICE_RADIUS_KM,
  haversineKm,
  isWithinServiceArea,
} from './service-area.util';

describe('service-area.util', () => {
  describe('haversineKm', () => {
    it('renvoie ~0 pour deux points identiques (la base elle-même)', () => {
      const d = haversineKm(SERVICE_BASE.lat, SERVICE_BASE.lng, SERVICE_BASE.lat, SERVICE_BASE.lng);
      expect(d).toBeCloseTo(0, 6);
    });

    it('calcule une distance connue base → Montréal (~160 km)', () => {
      // Montréal ≈ 45.5019, -73.5674 — connu hors zone (~160 km de Gatineau).
      const d = haversineKm(SERVICE_BASE.lat, SERVICE_BASE.lng, 45.5019, -73.5674);
      expect(d).toBeGreaterThan(150);
      expect(d).toBeLessThan(180);
    });

    it('est symétrique', () => {
      const ab = haversineKm(SERVICE_BASE.lat, SERVICE_BASE.lng, 43.6532, -79.3832);
      const ba = haversineKm(43.6532, -79.3832, SERVICE_BASE.lat, SERVICE_BASE.lng);
      expect(ab).toBeCloseTo(ba, 6);
    });
  });

  describe('isWithinServiceArea', () => {
    it('place la base elle-même DANS la zone', () => {
      expect(isWithinServiceArea(SERVICE_BASE.lat, SERVICE_BASE.lng)).toBe(true);
    });

    it('place Montréal (~160 km) HORS zone', () => {
      expect(isWithinServiceArea(45.5019, -73.5674)).toBe(false);
    });

    it('place Toronto (~450 km) HORS zone', () => {
      expect(isWithinServiceArea(43.6532, -79.3832)).toBe(false);
    });

    // Bornes du seuil : on construit deux points plein est de la base à des distances calibrées.
    // 1° de longitude à 45.4765° de latitude ≈ 111.32 * cos(45.4765°) ≈ 78.16 km.
    const kmPerDegLng = haversineKm(SERVICE_BASE.lat, SERVICE_BASE.lng, SERVICE_BASE.lat, SERVICE_BASE.lng + 1);

    it('inclut un point juste SOUS le rayon (~99 km)', () => {
      const lng = SERVICE_BASE.lng + 99 / kmPerDegLng;
      expect(haversineKm(SERVICE_BASE.lat, SERVICE_BASE.lng, SERVICE_BASE.lat, lng)).toBeLessThan(
        SERVICE_RADIUS_KM,
      );
      expect(isWithinServiceArea(SERVICE_BASE.lat, lng)).toBe(true);
    });

    it('exclut un point juste AU-DELÀ du rayon (~101 km)', () => {
      const lng = SERVICE_BASE.lng + 101 / kmPerDegLng;
      expect(haversineKm(SERVICE_BASE.lat, SERVICE_BASE.lng, SERVICE_BASE.lat, lng)).toBeGreaterThan(
        SERVICE_RADIUS_KM,
      );
      expect(isWithinServiceArea(SERVICE_BASE.lat, lng)).toBe(false);
    });

    it('traite des coordonnées nulles comme « non hors zone » (pas d’avertissement)', () => {
      expect(isWithinServiceArea(null, null)).toBe(true);
      expect(isWithinServiceArea(45.4765, null)).toBe(true);
      expect(isWithinServiceArea(null, -75.7013)).toBe(true);
    });
  });
});
