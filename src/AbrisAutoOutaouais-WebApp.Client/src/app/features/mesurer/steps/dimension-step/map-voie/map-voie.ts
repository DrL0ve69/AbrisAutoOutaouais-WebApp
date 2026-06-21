import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { createAddressFormController } from '../../../../../core/services/address-form.controller';
import { PlacesService } from '../../../../../core/services/places.service';
import { PlaceSuggestionDto } from '../../../../../core/models/place.model';
import { AddressAutocompleteComponent } from '../../../../../shared/components/a11y-components/autocomplete/address-autocomplete.component';
import { AddressChoiceComponent } from '../../../../../shared/components/a11y-components/address-choice/address-choice.component';
import { CIVIC_PATTERN } from '../../../../../core/validators/address.validators';
import { isWithinServiceArea } from '../../../util/service-area.util';
import { Footprint } from '../../../util/footprint.util';
import { MapMeasureComponent } from '../map-measure/map-measure';

/**
 * Voie « Mesurer sur la carte » (EPIC 13, sous-tâche 13.2) — l'input adresse et la carte
 * satellite cohabitent sur LA MÊME page. L'utilisateur situe son stationnement (saisie ou
 * suggestion), la carte se centre dessus, puis il trace le rectangle pour obtenir le gabarit.
 *
 * Adresse RÉUTILISÉE telle quelle (EPIC 15 = spike only, pas de refonte) : `app-address-choice`
 * + `app-address-autocomplete` + `createAddressFormController` — exactement l'idiome de l'ancien
 * `address-step`, migré ici. Le code postal n'est PAS requis pour mesurer un stationnement (pas
 * de contrôle `postalCode` ; `AddressAutofillService` l'ignore alors silencieusement).
 *
 * Géocodage (D4) : `PlacesService.geocode` (réutilise `suggest`, pas d'endpoint dédié) pour
 * obtenir lat/lng à partir de l'adresse saisie/préremplie sans choix de suggestion. Une
 * suggestion choisie porte déjà lat/lng → centrage immédiat sans géocoder.
 *
 * Zone de service (D5) : `isWithinServiceArea` → avertissement DOUX `role="status"`, NON bloquant
 * (la mesure reste possible hors zone). Aucune règle ne bloque (L-004 §C1 : pas de rejet serveur).
 *
 * Connecté (D6/L-003) : l'adresse de profil vit dans `/auth/me` (pas dans `AuthUser`). Le
 * contrôleur la pré-remplit en pristine-only (L-002) et, dès qu'elle est disponible, on centre
 * automatiquement la carte dessus (géocodage), tout en la laissant modifiable.
 *
 * Accessibilité :
 *  - Avertissement « hors zone » via `role="status"`/`aria-live` SCOPÉ (L-010, jamais global) ;
 *    feedback de géocodage idem, repassé par chaîne vide avant chaque message (L-027).
 *  - La carte est montée derrière `@defer (on immediate)` SSR-safe (Leaflet/geoman hors bundle
 *    initial), inchangée fonctionnellement (`map-measure`).
 */
@Component({
  selector: 'app-map-voie',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    AddressAutocompleteComponent,
    AddressChoiceComponent,
    MapMeasureComponent,
  ],
  templateUrl: './map-voie.html',
  styleUrl: './map-voie.scss',
})
export class MapVoieComponent {
  private readonly fb = inject(FormBuilder);
  private readonly places = inject(PlacesService);
  private readonly destroyRef = inject(DestroyRef);

  /** Gabarit déduit du tracé sur la carte — remonte au `dimension-step` puis au shell. */
  readonly footprintComputed = output<Footprint>();

  /** Centre de la carte (lat/lng) issu de la suggestion choisie ou du géocodage. `null` = repli Gatineau. */
  protected readonly lat = signal<number | null>(null);
  protected readonly lng = signal<number | null>(null);

  /** D5 — vrai quand l'adresse localisée est HORS zone de service (~100 km). Avertissement non bloquant. */
  protected readonly outOfServiceArea = signal(false);

  /** D4 — vrai pendant un géocodage (annonce `aria-live` + `aria-busy` du bouton). */
  protected readonly geocoding = signal<'idle' | 'busy'>('idle');

  protected readonly form = this.fb.nonNullable.group({
    civicNumber: ['', [Validators.required, Validators.pattern(CIVIC_PATTERN)]],
    street: ['', Validators.required],
    city: ['', Validators.required],
    province: ['QC', Validators.required],
  });

  /**
   * Câblage « adresse » mutualisé (pastille profil + recopie force D6, pré-remplissage
   * pristine-only L-002). Le crochet `onModeChange` réinitialise le centre mémorisé à chaque
   * bascule (l'adresse profil n'a pas de lat/lng tant qu'on ne l'a pas géocodée).
   */
  protected readonly addr = createAddressFormController(this.form, {
    onModeChange: () => this.resetLocation(),
  });

  constructor() {
    // D6/L-003 — connecté avec adresse de profil : on centre AUTOMATIQUEMENT la carte dessus en
    // géocodant l'adresse de profil. La dépendance est le SIGNAL `addr.profileAddress()`
    // (= `ProfileService.defaultDeliveryAddress`), pas `form.getRawValue()` qui n'est PAS réactif :
    // l'adresse arrive de façon asynchrone (/auth/me), et seule une lecture de signal re-planifie
    // l'effet. On lit donc l'adresse à la source plutôt que les champs du formulaire (qu'un
    // `setValue` du contrôleur ne notifie pas à cet effet). Modifiable ensuite (la bascule « autre
    // adresse » réinitialise via `onModeChange`). Invité (pas d'adresse) ⇒ no-op.
    effect(() => {
      const address = this.addr.profileAddress();
      if (this.addr.addressMode() !== 'profile' || !address) return;
      if (this.lat() !== null || this.geocoding() === 'busy') return;
      this.geocodeAndCenter(address.civicNumber, address.street, address.city, address.province || 'QC');
    });
  }

  protected get f() {
    return this.form.controls;
  }

  /** Choix explicite d'une suggestion : lat/lng connus → centrage immédiat (pas de géocodage). */
  protected onSuggestionSelected(s: PlaceSuggestionDto): void {
    // Patch civic/rue/ville/province (action utilisateur, hors garde pristine L-002). On ignore le
    // code postal (non requis ici) ; pas d'annonce postale (le contrôleur borne l'abonnement).
    this.addr.applySuggestion(s).subscribe();
    this.center(s.lat, s.lng);
  }

  /** Centre la carte sur l'adresse SAISIE manuellement (sans suggestion) en la géocodant (D4). */
  protected centerOnAddress(): void {
    if (this.form.invalid || this.geocoding() === 'busy') {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.geocodeAndCenter(v.civicNumber, v.street, v.city, v.province || 'QC');
  }

  /** Géocode l'adresse puis centre la carte ; `null` = adresse non localisée (repli Gatineau, non bloquant). */
  private geocodeAndCenter(
    civicNumber: string,
    street: string,
    city: string,
    province: string,
  ): void {
    // L'annonce « Localisation… » est rendue par INSERTION du nœud `<p role="status">` (`@if` dans
    // le template), pas par mutation de texte d'une live-region persistante : l'insertion suffit donc
    // à la (ré)annonce. On repasse tout de même par 'idle' pour garder l'état déterministe (cohérent
    // avec l'esprit L-027 : neutre avant chaque cycle).
    this.geocoding.set('idle');
    this.geocoding.set('busy');
    this.places
      .geocode(civicNumber, street, city, province)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (suggestion) => {
          this.geocoding.set('idle');
          this.center(suggestion?.lat ?? null, suggestion?.lng ?? null);
        },
        error: () => {
          this.geocoding.set('idle');
          this.center(null, null);
        },
      });
  }

  /** Pose le centre de la carte et recalcule l'avertissement « hors zone » (D5). */
  private center(lat: number | null, lng: number | null): void {
    this.lat.set(lat);
    this.lng.set(lng);
    // `isWithinServiceArea` renvoie `true` pour des coordonnées inconnues → pas d'avertissement
    // tant que l'adresse n'est pas localisée (on n'affirme jamais « hors zone » à tort).
    this.outOfServiceArea.set(!isWithinServiceArea(lat, lng));
  }

  /** Réinitialise le centre mémorisé (bascule de pastille) : la prochaine adresse repassera par le géocodage. */
  private resetLocation(): void {
    this.lat.set(null);
    this.lng.set(null);
    this.outOfServiceArea.set(false);
  }

  protected onFootprint(footprint: Footprint): void {
    this.footprintComputed.emit(footprint);
  }
}
