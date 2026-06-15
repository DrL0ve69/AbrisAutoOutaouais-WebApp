import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { FirstLoginHintService } from './first-login-hint.service';

// ── FirstLoginHintService (E2) ────────────────────────────────────────────────
// Décision marqueur sans backend : l'alerte « entrez votre adresse » s'affiche tant
// que l'adresse de profil est vide ET que l'utilisateur ne l'a pas rejetée (drapeau
// localStorage par userId). Aucun accès réseau ; on exerce juste la logique + storage.

const USER_ID = 'user-1';

describe('FirstLoginHintService', () => {
  let service: FirstLoginHintService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(FirstLoginHintService);
  });

  it("montre l'alerte si l'adresse est vide et qu'elle n'a pas été rejetée", () => {
    expect(service.shouldShowAddressHint(USER_ID, false)).toBe(true);
  });

  it("ne montre PAS l'alerte si l'adresse est déjà remplie", () => {
    expect(service.shouldShowAddressHint(USER_ID, true)).toBe(false);
  });

  it("ne montre PAS l'alerte si elle a déjà été rejetée", () => {
    service.dismiss(USER_ID);
    expect(service.shouldShowAddressHint(USER_ID, false)).toBe(false);
  });

  it('dismiss() persiste le rejet dans localStorage (par userId)', () => {
    service.dismiss(USER_ID);
    expect(localStorage.getItem('first-address-hint-dismissed:' + USER_ID)).toBe('1');
  });

  it("le rejet est scopé par utilisateur : un autre compte revoit l'alerte", () => {
    service.dismiss(USER_ID);
    expect(service.shouldShowAddressHint('user-2', false)).toBe(true);
  });

  it("ne montre PAS l'alerte sans userId (utilisateur non identifié)", () => {
    expect(service.shouldShowAddressHint('', false)).toBe(false);
  });
});
