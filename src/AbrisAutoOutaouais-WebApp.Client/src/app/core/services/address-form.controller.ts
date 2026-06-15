import { DestroyRef, Injector, effect, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup } from '@angular/forms';
import { Observable } from 'rxjs';
import { ProfileService } from './profile.service';
import { AddressAutofillService, PostalFillResult } from './address-autofill.service';
import { PlaceSuggestionDto } from '../models/place.model';

/** Issue de la résolution du code postal après le choix d'une suggestion (aria-live). */
export type PostalFillState = 'idle' | 'filled' | 'unavailable';

/** Mode de choix d'adresse : « profile » (pastille) ou « other » (formulaire éditable). */
export type AddressMode = 'profile' | 'other';

/** Dépendances + options du contrôleur — fournies par le composant hôte. */
export interface AddressFormControllerDeps {
  readonly addressAutofill: AddressAutofillService;
  readonly profile: ProfileService;
  readonly destroyRef: DestroyRef;
  /**
   * Contexte d'injection pour l'`effect` de recopie force. À passer explicitement car le contrôleur
   * peut être instancié hors du constructeur du composant — `effect(fn, { injector })` lève alors
   * « NG0203 » si l'injecteur manque. (Voir piège « effect hors contexte d'injection ».)
   */
  readonly injector: Injector;
  /**
   * Crochet optionnel exécuté à chaque bascule de mode, AVANT la recopie éventuelle. Permet à un
   * écran qui mémorise un état dérivé de l'adresse (ex. `address-step` : lat/lng de la dernière
   * suggestion) de le réinitialiser à chaque changement de mode.
   */
  readonly onModeChange?: (mode: AddressMode) => void;
}

/**
 * Contrôleur réutilisable du câblage « adresse » partagé par les 4 écrans consommateurs
 * (caisse, location, installation, étape adresse du mesureur). Factorise le bloc autrefois
 * dupliqué à l'identique sur chacun (PR #34, dé-duplication SonarCloud) :
 *  - 3 états : `postalFill` (annonce aria-live, L-027), `profileAddress` (pastille
 *    `app-address-choice`, null = invité ⇒ formulaire direct), `addressMode` (« profile »/« other ») ;
 *  - le chargement du profil (`ensureLoaded`) + l'`effect` de recopie FORCE : en mode « profile »,
 *    on copie l'adresse de profil dans TOUS les contrôles d'adresse (même en lecture seule à
 *    l'écran) pour qu'une soumission parte valide (D6) ; invité (adresse null) ⇒ no-op ;
 *  - `onAddressMode` : bascule de la pastille. Vers « other », pré-remplit les champs encore
 *    INTACTS avec l'adresse de profil comme point de départ éditable (garde pristine L-002) ;
 *    le retour à « profile » est traité par l'`effect` (recopie force) ;
 *  - `onSuggestionSelected` : choix explicite d'une suggestion → patch civic/rue/ville/province
 *    INCONDITIONNEL (action utilisateur, hors garde pristine L-002), code postal résolu/normalisé
 *    (L-004) et resté éditable, via `AddressAutofillService`. Le `postalFill` repasse par 'idle'
 *    AVANT chaque résolution : sans ce reset, deux résolutions au même statut n'émettraient pas
 *    (signal idempotent) → pas de ré-annonce (L-027) ;
 *  - `onStreetInput` : frappe libre dans le combobox → synchronise le contrôle « rue ».
 *
 * C'est une CLASSE simple instanciée PAR composant (état par-composant), pas un service singleton.
 */
export class AddressFormController {
  /** Annonce (aria-live) : issue de la résolution du code postal après choix d'une suggestion. */
  readonly postalFill = signal<PostalFillState>('idle');
  /** Adresse de profil pour la pastille `app-address-choice` (null = invité ⇒ formulaire direct). */
  readonly profileAddress = this.deps.profile.defaultDeliveryAddress;
  /** Mode de choix d'adresse : « profile » (pastille) ou « other » (formulaire éditable). */
  readonly addressMode = signal<AddressMode>('profile');

  constructor(
    private readonly form: FormGroup,
    private readonly deps: AddressFormControllerDeps,
  ) {
    // D6 — utilisateur connecté avec adresse de profil : mode « profile » par défaut (pastille).
    // En mode profil, on COPIE l'adresse de profil dans le formulaire (force) pour qu'une
    // soumission parte valide même si la pastille est en lecture seule. L'adresse arrive de façon
    // asynchrone (/auth/me) : l'effet la recopie dès qu'elle est disponible. Invité (adresse null)
    // ⇒ `applyDefaultAddress` no-op et `app-address-choice` rend le formulaire direct (inchangé).
    this.deps.profile.ensureLoaded();
    effect(
      () => {
        if (this.addressMode() === 'profile') {
          this.deps.profile.applyDefaultAddress(this.form, undefined, true);
        }
      },
      { injector: this.deps.injector },
    );
  }

  /**
   * Bascule de la pastille d'adresse (`app-address-choice`). En passant à « other », pré-remplit
   * les champs encore intacts avec l'adresse de profil comme point de départ éditable (garde
   * pristine L-002). Le retour à « profile » est traité par l'effet (recopie force).
   */
  onAddressMode(mode: AddressMode): void {
    this.addressMode.set(mode);
    this.deps.onModeChange?.(mode);
    if (mode === 'other') {
      this.deps.profile.applyDefaultAddress(this.form);
    }
  }

  /**
   * Choix explicite d'une suggestion — patche le formulaire puis résout/annonce le code postal.
   * Repasse `postalFill` par 'idle' AVANT la résolution (L-027) afin que deux issues identiques
   * successives soient bien ré-annoncées.
   */
  onSuggestionSelected(s: PlaceSuggestionDto): void {
    this.postalFill.set('idle');
    this.applySuggestion(s).subscribe(result => this.postalFill.set(result.status));
  }

  /**
   * Applique une suggestion au formulaire (patch + résolution du code postal) et retourne le flux
   * d'issue déjà borné au cycle de vie du composant (`takeUntilDestroyed`). Exposé pour les écrans
   * qui doivent enchaîner un traitement propre (ex. `address-step` mémorise lat/lng et n'affiche pas
   * l'annonce postale) sans recopier la gestion d'abonnement.
   */
  applySuggestion(s: PlaceSuggestionDto): Observable<PostalFillResult> {
    return this.deps.addressAutofill
      .applySuggestion(this.form, s)
      .pipe(takeUntilDestroyed(this.deps.destroyRef));
  }

  /** Frappe libre dans le combobox : synchronise le contrôle « rue ». */
  onStreetInput(value: string): void {
    this.deps.addressAutofill.syncStreet(this.form, value);
  }
}

/**
 * Fabrique le contrôleur d'adresse pour un composant. À appeler PENDANT la construction du composant
 * (initialiseur de champ ou corps du constructeur) ; l'`injector` passé est utilisé explicitement par
 * le `effect` interne de recopie force (`effect(fn, { injector })`), ce qui rend l'appel valide même
 * depuis un initialiseur de champ — sans dépendre du contexte d'injection ambiant (pas de NG0203).
 */
export function createAddressFormController(
  form: FormGroup,
  deps: AddressFormControllerDeps,
): AddressFormController {
  return new AddressFormController(form, deps);
}
