import { DestroyRef, Injector, effect, inject, signal } from '@angular/core';
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

/** Dépendances résolues par injection — internes au contrôleur, non fournies par l'écran. */
interface AddressFormControllerDeps {
  readonly addressAutofill: AddressAutofillService;
  readonly profile: ProfileService;
  readonly destroyRef: DestroyRef;
  readonly injector: Injector;
}

/** Options spécifiques à l'écran hôte — tout ce qui n'est PAS une dépendance injectable. */
export interface AddressFormControllerOptions {
  /**
   * Crochet optionnel exécuté à chaque bascule de mode, AVANT la recopie éventuelle. Permet à un
   * écran qui mémorise un état dérivé de l'adresse (ex. `map-voie` : lat/lng/centre de la carte)
   * de le réinitialiser à chaque changement de mode.
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
    private readonly options: AddressFormControllerOptions,
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
    this.options.onModeChange?.(mode);
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
   * qui doivent enchaîner un traitement propre (ex. `map-voie` mémorise lat/lng et n'affiche pas
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
 * (initialiseur de champ ou corps du constructeur) : la fabrique résout elle-même ses dépendances via
 * `inject()` (contexte d'injection garanti pendant la construction), ce qui dispense chaque écran de
 * les ré-injecter puis de les transmettre (PR #34, dé-duplication SonarCloud). L'`Injector` ainsi
 * obtenu est passé explicitement à l'`effect` interne de recopie force (`effect(fn, { injector })`),
 * ce qui rend l'appel valide même depuis un initialiseur de champ (pas de NG0203). `options` ne porte
 * que le spécifique à l'écran (ex. crochet `onModeChange`).
 */
export function createAddressFormController(
  form: FormGroup,
  options: AddressFormControllerOptions = {},
): AddressFormController {
  const deps: AddressFormControllerDeps = {
    addressAutofill: inject(AddressAutofillService),
    profile: inject(ProfileService),
    destroyRef: inject(DestroyRef),
    injector: inject(Injector),
  };
  return new AddressFormController(form, deps, options);
}
