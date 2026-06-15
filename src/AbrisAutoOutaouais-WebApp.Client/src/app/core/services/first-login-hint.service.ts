import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';

/**
 * Préfixe de la clé localStorage qui mémorise que l'utilisateur a rejeté l'alerte
 * « entrez votre adresse » (par identifiant de compte, pour ne jamais fuiter le
 * choix d'un compte vers un autre). La clé complète est `PREFIX + userId`.
 */
const DISMISSED_KEY_PREFIX = 'first-address-hint-dismissed:';

/**
 * Décide si l'alerte non bloquante « entrez votre adresse » doit s'afficher à la
 * première connexion, et mémorise son rejet.
 *
 * Décision marqueur (E2, AUCUNE migration backend) : « première connexion » =
 * l'adresse de profil est VIDE (`defaultDeliveryAddress === null`, lue via
 * `ProfileService` — jamais via `AuthUser`, qui ne porte pas l'adresse, leçon
 * L-003) ET l'alerte n'a jamais été rejetée pour ce compte. Aucun champ serveur,
 * aucun DTO modifié : l'état « déjà vu » vit uniquement en `localStorage`.
 *
 * SSR-safe (calque l'idiome de `LocaleService`) : aucun accès `localStorage` au
 * niveau module ; côté serveur, l'aide est toujours masquée et `dismiss()` est un
 * no-op (rien à persister hors navigateur).
 */
@Injectable({ providedIn: 'root' })
export class FirstLoginHintService {
  private readonly platform = inject(PLATFORM_ID);

  /**
   * Vrai si l'alerte d'adresse doit être montrée : l'adresse est absente ET
   * l'utilisateur ne l'a pas déjà rejetée. Toujours faux côté serveur (SSR).
   */
  shouldShowAddressHint(userId: string, hasAddress: boolean): boolean {
    if (!isPlatformBrowser(this.platform)) return false;
    if (!userId || hasAddress) return false;
    return !this.isDismissed(userId);
  }

  /** Mémorise que l'utilisateur a rejeté l'alerte (persistant). No-op côté serveur. */
  dismiss(userId: string): void {
    if (!isPlatformBrowser(this.platform) || !userId) return;
    try {
      localStorage.setItem(DISMISSED_KEY_PREFIX + userId, '1');
    } catch {
      // localStorage indisponible (mode privé, quota) → le rejet n'est pas persisté ;
      // l'alerte pourra réapparaître au prochain chargement, ce qui reste sûr.
    }
  }

  private isDismissed(userId: string): boolean {
    try {
      return localStorage.getItem(DISMISSED_KEY_PREFIX + userId) === '1';
    } catch {
      return false;
    }
  }
}
