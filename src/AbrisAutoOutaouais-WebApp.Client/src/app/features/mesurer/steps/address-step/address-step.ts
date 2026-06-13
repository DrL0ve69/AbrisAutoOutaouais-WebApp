import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProfileService } from '../../../../core/services/profile.service';
import { AddressAutofillService } from '../../../../core/services/address-autofill.service';
import { PlaceSuggestionDto } from '../../../../core/models/place.model';
import { AddressAutocompleteComponent } from '../../../../shared/components/a11y-components/autocomplete/address-autocomplete.component';
import { CIVIC_PATTERN } from '../../../../core/validators/address.validators';

/** Adresse choisie à l'étape 1, transmise au shell (porte lat/lng pour centrer la carte). */
export interface MesurerAddress {
  readonly civicNumber: string;
  readonly street: string;
  readonly city: string;
  readonly province: string;
  readonly lat: number | null;
  readonly lng: number | null;
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
  imports: [ReactiveFormsModule, AddressAutocompleteComponent],
  templateUrl: './address-step.html',
  styleUrl: './address-step.scss',
})
export class AddressStepComponent {
  private readonly fb = inject(FormBuilder);
  private readonly profile = inject(ProfileService);
  private readonly addressAutofill = inject(AddressAutofillService);
  private readonly destroyRef = inject(DestroyRef);

  /** Adresse validée (avec lat/lng éventuels) prête pour l'étape mesure. */
  readonly addressSelected = output<MesurerAddress>();

  /** lat/lng issus de la dernière suggestion choisie (null si saisie purement manuelle). */
  private lat: number | null = null;
  private lng: number | null = null;

  protected readonly form = this.fb.nonNullable.group({
    civicNumber: ['', [Validators.required, Validators.pattern(CIVIC_PATTERN)]],
    street: ['', Validators.required],
    city: ['', Validators.required],
    province: ['QC', Validators.required],
  });

  constructor() {
    this.profile.ensureLoaded();
    // Pré-remplissage pristine-only de l'adresse par défaut (L-002).
    effect(() => this.profile.applyDefaultAddress(this.form));
  }

  protected get f() {
    return this.form.controls;
  }

  protected onStreetInput(value: string): void {
    this.addressAutofill.syncStreet(this.form, value);
  }

  protected onSuggestionSelected(s: PlaceSuggestionDto): void {
    this.lat = s.lat;
    this.lng = s.lng;
    // Patch civic/rue/ville/province (action utilisateur, hors garde pristine). On ignore le
    // code postal : non requis pour mesurer un stationnement.
    this.addressAutofill
      .applySuggestion(this.form, s)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.addressSelected.emit({
      civicNumber: v.civicNumber,
      street: v.street,
      city: v.city,
      province: v.province || 'QC',
      lat: this.lat,
      lng: this.lng,
    });
  }
}
