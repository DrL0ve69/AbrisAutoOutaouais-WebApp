import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { describe, it, expect } from 'vitest';
import { MotionService } from './motion.service';

describe('MotionService', () => {
  it('vaut false par défaut (rendu serveur — aucun accès à window/matchMedia)', () => {
    // On force la plateforme serveur : le service ne doit JAMAIS toucher window/matchMedia.
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });
    const service = TestBed.inject(MotionService);
    expect(service.prefersReducedMotion()).toBe(false);
  });

  it("reflète l'état initial de la media-query en navigateur", () => {
    // En navigateur (défaut du runner vitest browser), le signal lit matchMedia au démarrage.
    // La valeur dépend de l'environnement réel ; on vérifie seulement le type booléen + la
    // cohérence avec matchMedia (pas de valeur figée → assertion non vacue, cf. L-002).
    TestBed.configureTestingModule({});
    const service = TestBed.inject(MotionService);
    const expected = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    expect(service.prefersReducedMotion()).toBe(expected);
  });
});
