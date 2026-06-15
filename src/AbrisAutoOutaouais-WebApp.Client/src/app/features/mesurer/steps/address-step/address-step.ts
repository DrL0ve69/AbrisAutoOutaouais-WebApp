import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  inject,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProfileService } from '../../../../core/services/profile.service';
import { AddressAutofillService } from '../../../../core/services/address-autofill.service';
import { createAddressFormController } from '../../../../core/services/address-form.controller';
import { PlacesService } from '../../../../core/services/places.service';
import { PlaceSuggestionDto } from '../../../../core/models/place.model';
import { AddressAutocompleteComponent } from '../../../../shared/components/a11y-components/autocomplete/address-autocomplete.component';
import { AddressChoiceComponent } from '../../../../shared/components/a11y-components/address-choice/address-choice.component';
import { CIVIC_PATTERN } from '../../../../core/validators/address.validators';
import { isWithinServiceArea } from '../../util/service-area.util';

/** Adresse choisie à l'étape 1, transmise au shell (porte lat/lng pour centrer la carte). */
export interface MesurerAddress {
  readonly civicNumber: string;
  readonly street: string;
  readonly city: string;
  readonly province: string;
  readonly lat: number | null;
  readonly lng: number | null;
  /** D5 — adresse géolocalisée HORS zone de service (~100 km) : avertissement doux, non bloquant. */
  readonly outOfServiceArea: boolean;
}

/**
 * Étape 1 « Adresse » — saisie de l'adresse du stationnement via le combobox C3 réutilisable
 * (`id="mesurer-rue"`, id unique pour éviter la collision L-013). Pré-remplit l'adresse de
 * profil en pristine-only (L-002/L-003 via `ProfileService.applyDefaultAddress`).
 *
 * Émet `addressSelected` quand l'utilisateur confirme une adresse exploitable. On retient les
 * dernières coordonnées d'une suggestion choisie (lat/lng) pour centrer la carte à l'étape 2.
 */
@Component({
  selector: 'app-address-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, AddressAutocompleteComponent, AddressChoiceComponent],
  templateUrl: './address-step.html',
  styleUrl: './address-step.scss',
})
export class AddressStepComponent {
  private readonly fb = inject(FormBuilder);
  private readonly profile = inject(ProfileService);
  private readonly addressAutofill = inject(AddressAutofillService);
  private readonly places = inject(PlacesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  /** Adresse validée (avec lat/lng éventuels) prête pour l'étape mesure. */
  readonly addressSelected = output<MesurerAddress>();

  /** lat/lng issus de la dernière suggestion choisie (null si saisie purement manuelle). */
  private lat: number | null = null;
  private lng: number | null = null;

  /** D4 — vrai pendant le géocodage à la soumission (désactive le bouton + `aria-busy`). */
  protected readonly geocoding = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    civicNumber: ['', [Validators.required, Validators.pattern(CIVIC_PATTERN)]],
    street: ['', Validators.required],
    city: ['', Validators.required],
    province: ['QC', Validators.required],
  });

  /**
   * Câblage « adresse » mutualisé (pastille profil + recopie force D6). Le code postal est
   * OPTIONNEL : ce formulaire n'a pas de contrôle `postalCode` (non requis pour mesurer un
   * stationnement) — `AddressAutofillService` ignore alors silencieusement le code postal et le
   * contrôleur expose tout de même `postalFill`, qu'on n'affiche pas ici. Le crochet `onModeChange`
   * réinitialise les coordonnées mémorisées à chaque bascule (l'adresse profil n'a pas de lat/lng,
   * donc la soumission repassera par le géocodage D4, sauf si une suggestion est ensuite choisie).
   */
  private readonly addr = createAddressFormController(this.form, {
    addressAutofill: this.addressAutofill,
    profile: this.profile,
    destroyRef: this.destroyRef,
    injector: this.injector,
    onModeChange: () => {
      this.lat = null;
      this.lng = null;
    },
  });

  // Membres ré-exposés tels quels pour le template (zéro churn HTML/spec).
  protected readonly profileAddress = this.addr.profileAddress;
  protected readonly addressMode = this.addr.addressMode;
  protected readonly onAddressMode = (mode: 'profile' | 'other'): void => this.addr.onAddressMode(mode);
  protected readonly onStreetInput = (value: string): void => this.addr.onStreetInput(value);

  protected get f() {
    return this.form.controls;
  }

  protected onSuggestionSelected(s: PlaceSuggestionDto): void {
    this.lat = s.lat;
    this.lng = s.lng;
    // Patch civic/rue/ville/province (action utilisateur, hors garde pristine). On ignore le
    // code postal : non requis pour mesurer un stationnement. Pas d'annonce postale ici (le
    // contrôleur gère l'abonnement/`takeUntilDestroyed`).
    this.addr.applySuggestion(s).subscribe();
  }

  protected submit(): void {
    if (this.form.invalid || this.geocoding()) {
      this.form.markAllAsTouched();
      return;
    }

    // Cas nominal : une suggestion a été choisie → lat/lng connus, on émet directement.
    if (this.lat !== null && this.lng !== null) {
      this.emitAddress(this.lat, this.lng);
      return;
    }

    // D4 — adresse saisie/préremplie SANS suggestion (pas de lat/lng) : on géocode avant d'émettre
    // pour centrer la carte sur la vraie adresse (sinon repli Gatineau). On réutilise `suggest` via
    // `places.geocode` (pas d'endpoint dédié). Busy state pendant l'appel (bouton désactivé).
    const v = this.form.getRawValue();
    this.geocoding.set(true);
    this.places
      .geocode(v.civicNumber, v.street, v.city, v.province || 'QC')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (suggestion) => {
          this.geocoding.set(false);
          // Géocodage infructueux → lat/lng null : la carte retombe sur Gatineau et `notLocated()`
          // (map-measure) affiche déjà un indice. On émet quand même pour ne pas bloquer le flux.
          this.emitAddress(suggestion?.lat ?? null, suggestion?.lng ?? null);
        },
        error: () => {
          this.geocoding.set(false);
          this.emitAddress(null, null);
        },
      });
  }

  /** Calcule `outOfServiceArea` (D5) pour les coordonnées données puis émet l'adresse vers le shell. */
  private emitAddress(lat: number | null, lng: number | null): void {
    const v = this.form.getRawValue();
    const outOfZone = !isWithinServiceArea(lat, lng);
    this.addressSelected.emit({
      civicNumber: v.civicNumber,
      street: v.street,
      city: v.city,
      province: v.province || 'QC',
      lat,
      lng,
      outOfServiceArea: outOfZone,
    });
  }
}
