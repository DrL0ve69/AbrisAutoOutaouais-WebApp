import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { RentalService } from '../../core/services/rental.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ProfileService } from '../../core/services/profile.service';
import { AddressAutofillService } from '../../core/services/address-autofill.service';
import { ProductSummaryDto } from '../../core/models/product.model';
import { CreateRentalContractRequest } from '../../core/models/rental.model';
import { PlaceSuggestionDto } from '../../core/models/place.model';
import { FaqComponent } from '../../shared/components/faq/faq.component';
import { AddressAutocompleteComponent } from '../../shared/components/a11y-components/autocomplete/address-autocomplete.component';
import { AddressChoiceComponent } from '../../shared/components/a11y-components/address-choice/address-choice.component';
import { LOCATION_FAQ } from '../../shared/content/faq.data';
import { CIVIC_PATTERN, POSTAL_PATTERN, normalizePostal } from '../../core/validators/address.validators';

/**
 * Location saisonnière d'abris.
 * Liste les produits louables, laisse choisir un abri + une période + une adresse,
 * puis crée le contrat de location.
 */
@Component({
  selector: 'app-location',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    CurrencyPipe,
    FaqComponent,
    AddressAutocompleteComponent,
    AddressChoiceComponent,
  ],
  templateUrl: './location.html',
  styleUrl: './location.scss',
})
export class LocationComponent implements OnInit {
  /** Entrées FAQ de la page (durée, dépôt, annulation, installation). */
  protected readonly faq = LOCATION_FAQ;

  private readonly fb = inject(FormBuilder);
  private readonly products = inject(ProductService);
  private readonly rentals = inject(RentalService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly profile = inject(ProfileService);
  private readonly addressAutofill = inject(AddressAutofillService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  /** Annonce (aria-live) : issue de la résolution du code postal après choix d'une suggestion. */
  protected readonly postalFill = signal<'idle' | 'filled' | 'unavailable'>('idle');
  /** Adresse de profil pour la pastille `app-address-choice` (null = invité ⇒ formulaire direct). */
  protected readonly profileAddress = this.profile.defaultDeliveryAddress;
  /** Mode de choix d'adresse : « profile » (pastille) ou « other » (formulaire éditable). */
  protected readonly addressMode = signal<'profile' | 'other'>('profile');
  protected readonly rentable = signal<readonly ProductSummaryDto[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly hasProducts = computed(() => this.rentable().length > 0);
  protected readonly selectedProduct = computed(
    () => this.rentable().find(p => p.id === this.selectedId()) ?? null,
  );

  protected readonly form = this.fb.nonNullable.group({
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    civicNumber: ['', [Validators.required, Validators.pattern(CIVIC_PATTERN)]],
    street: ['', Validators.required],
    apartment: ['', Validators.maxLength(20)],
    city: ['', Validators.required],
    province: ['QC', Validators.required],
    postalCode: ['', [Validators.required, Validators.pattern(POSTAL_PATTERN)]],
  });

  constructor() {
    // D6 — voir CheckoutComponent : mode « profile » par défaut (pastille) avec recopie force de
    // l'adresse de profil (formulaire valide même si la pastille est en lecture seule) ; invité
    // (adresse null) ⇒ no-op et `app-address-choice` rend le formulaire direct (inchangé).
    this.profile.ensureLoaded();
    effect(() => {
      if (this.addressMode() === 'profile') {
        this.profile.applyDefaultAddress(this.form, undefined, true);
      }
    });
  }

  protected get f() {
    return this.form.controls;
  }

  /**
   * Bascule de la pastille d'adresse (`app-address-choice`). En passant à « other », pré-remplit
   * les champs intacts avec l'adresse de profil comme point de départ éditable (garde pristine
   * L-002). Le retour à « profile » est traité par l'effet (recopie force).
   */
  protected onAddressMode(mode: 'profile' | 'other'): void {
    this.addressMode.set(mode);
    if (mode === 'other') {
      this.profile.applyDefaultAddress(this.form);
    }
  }

  ngOnInit(): void {
    this.products.getProducts({ pageSize: 100 }).subscribe({
      next: page => {
        this.rentable.set((page.items ?? []).filter(p => p.rentalPrice != null));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected selectProduct(id: string): void {
    this.selectedId.set(id);
  }

  /**
   * Choix explicite d'une suggestion d'adresse — délègue à `AddressAutofillService` (logique
   * partagée par les 4 formulaires). Patch civic/rue/ville/province INCONDITIONNEL (action
   * utilisateur, hors garde pristine de L-002), code postal résolu/normalisé (L-004) et resté
   * éditable ; si le proxy renvoie null, on ne patche rien.
   */
  protected onSuggestionSelected(s: PlaceSuggestionDto): void {
    // Réinitialiser AVANT chaque sélection : sans repassage par 'idle', deux résolutions
    // successives au même statut n'émettraient pas (signal idempotent) → pas de ré-annonce.
    this.postalFill.set('idle');
    this.addressAutofill
      .applySuggestion(this.form, s)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => this.postalFill.set(result.status));
  }

  /** Frappe libre dans le combobox : synchronise le contrôle « rue ». */
  protected onStreetInput(value: string): void {
    this.addressAutofill.syncStreet(this.form, value);
  }

  protected confirm(): void {
    if (this.submitting()) return;

    if (!this.auth.isAuthenticated()) {
      this.toast.show(
        $localize`:@@location.authRequired:Connectez-vous pour louer un abri.`,
        'info',
      );
      this.router.navigateByUrl('/auth');
      return;
    }

    const productId = this.selectedId();
    if (!productId) {
      this.toast.show(
        $localize`:@@location.noProduct:Veuillez choisir un abri à louer.`,
        'error',
      );
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    if (v.endDate <= v.startDate) {
      this.toast.show(
        $localize`:@@location.badDates:La date de fin doit être après la date de début.`,
        'error',
      );
      return;
    }

    this.submitting.set(true);
    const request: CreateRentalContractRequest = {
      productId,
      startDate: v.startDate,
      endDate: v.endDate,
      address: {
        civicNumber: v.civicNumber,
        street: v.street,
        apartment: v.apartment.trim() || null,
        city: v.city,
        province: v.province || 'QC',
        postalCode: normalizePostal(v.postalCode),
        country: 'Canada',
      },
    };

    this.rentals.createRental(request).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.show(
          $localize`:@@location.success:Location confirmée !`,
          'success',
        );
        this.router.navigateByUrl('/mon-compte/locations');
      },
      error: () => {
        this.submitting.set(false);
        this.toast.show(
          $localize`:@@location.error:La location a échoué. Veuillez réessayer.`,
          'error',
        );
      },
    });
  }
}
