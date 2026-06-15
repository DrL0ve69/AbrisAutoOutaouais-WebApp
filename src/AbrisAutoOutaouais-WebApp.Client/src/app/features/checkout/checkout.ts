import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { OrderService } from '../../core/services/order.service';
import { ToastService } from '../../core/services/toast.service';
import { ProfileService } from '../../core/services/profile.service';
import { AddressAutofillService } from '../../core/services/address-autofill.service';
import { DeliveryType } from '../../core/models/order.model';
import { PlaceSuggestionDto } from '../../core/models/place.model';
import { AddressAutocompleteComponent } from '../../shared/components/a11y-components/autocomplete/address-autocomplete.component';
import { AddressChoiceComponent } from '../../shared/components/a11y-components/address-choice/address-choice.component';
import { CIVIC_PATTERN, POSTAL_PATTERN, normalizePostal } from '../../core/validators/address.validators';

/** Adresse requise uniquement si le mode de réception est « Livraison ». */
function addressRequiredIfDelivery(g: AbstractControl): ValidationErrors | null {
  if (g.get('deliveryType')?.value !== 'Delivery') return null;
  const missing = ['civicNumber', 'street', 'city', 'postalCode'].some(
    k => !(g.get(k)?.value ?? '').trim(),
  );
  return missing ? { addressRequired: true } : null;
}

/**
 * Caisse — AbrisTempo Local.
 *
 * PAIEMENT SIMULÉ (mode démo) : aucune transaction réelle n'est effectuée.
 * ▶ Point d'extension Stripe : remplacer `simulatePayment()` par la création d'un
 *   PaymentIntent côté serveur + confirmation via Stripe Elements, puis passer la
 *   commande à la confirmation du paiement (webhook `payment_intent.succeeded`).
 */
@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    CurrencyPipe,
    RouterLink,
    AddressAutocompleteComponent,
    AddressChoiceComponent,
  ],
})
export class CheckoutComponent {
  private readonly fb = inject(FormBuilder);
  private readonly cart = inject(CartService);
  private readonly orders = inject(OrderService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly profile = inject(ProfileService);
  private readonly addressAutofill = inject(AddressAutofillService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly items = this.cart.items;
  protected readonly subtotal = this.cart.subtotal;
  protected readonly count = this.cart.count;
  protected readonly isEmpty = computed(() => this.items().length === 0);
  protected readonly processing = signal(false);
  /** Annonce (aria-live) : issue de la résolution du code postal après choix d'une suggestion. */
  protected readonly postalFill = signal<'idle' | 'filled' | 'unavailable'>('idle');
  /** Adresse de profil pour la pastille `app-address-choice` (null = invité ⇒ formulaire direct). */
  protected readonly profileAddress = this.profile.defaultDeliveryAddress;
  /** Mode de choix d'adresse : « profile » (pastille) ou « other » (formulaire éditable). */
  protected readonly addressMode = signal<'profile' | 'other'>('profile');

  protected readonly form = this.fb.nonNullable.group(
    {
      deliveryType: ['Pickup' as DeliveryType, Validators.required],
      civicNumber: ['', Validators.pattern(CIVIC_PATTERN)],
      street: [''],
      apartment: [''],
      city: [''],
      province: ['QC'],
      postalCode: ['', Validators.pattern(POSTAL_PATTERN)],
      cardName: ['', Validators.required],
      cardNumber: ['', [Validators.required, Validators.pattern(/^\d{13,19}$/)]],
      expiry: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/\d{2}$/)]],
      cvc: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]],
    },
    { validators: addressRequiredIfDelivery },
  );

  constructor() {
    // D6 — utilisateur connecté avec adresse de profil : mode « profile » par défaut (pastille).
    // En mode profil, on COPIE l'adresse de profil dans le formulaire (force) pour qu'une
    // soumission parte valide même si la pastille est en lecture seule. L'adresse arrive de façon
    // asynchrone (/auth/me) : l'effet la recopie dès qu'elle est disponible. Invité (adresse null)
    // ⇒ `applyDefaultAddress` no-op et `app-address-choice` rend le formulaire direct (inchangé).
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
   * Bascule de la pastille d'adresse (`app-address-choice`). En passant à « other », on pré-remplit
   * les champs encore intacts avec l'adresse de profil comme point de départ éditable (garde
   * pristine de L-002). Le retour à « profile » est traité par l'effet (recopie force).
   */
  protected onAddressMode(mode: 'profile' | 'other'): void {
    this.addressMode.set(mode);
    if (mode === 'other') {
      this.profile.applyDefaultAddress(this.form);
    }
  }

  /**
   * Choix explicite d'une suggestion d'adresse — délègue à `AddressAutofillService` (logique
   * partagée par les 4 formulaires). Patch civic/rue/ville/province INCONDITIONNEL (action
   * utilisateur, hors garde pristine de L-002), code postal résolu/normalisé (L-004) et resté
   * éditable. `patchValue` re-déclenche le validateur de groupe `addressRequiredIfDelivery`.
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

  protected pay(): void {
    if (this.isEmpty() || this.processing()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.processing.set(true);
    const v = this.form.getRawValue();
    const lines = this.items().map(i => ({
      productId: i.product.id,
      quantity: i.quantity,
    }));
    const shippingAddress =
      v.deliveryType === 'Delivery'
        ? {
            civicNumber: v.civicNumber,
            street: v.street,
            apartment: v.apartment.trim() || null,
            city: v.city,
            province: v.province || 'QC',
            postalCode: normalizePostal(v.postalCode),
            country: 'Canada',
          }
        : null;

    // Paiement simulé (aucun appel réseau de paiement) — voir le commentaire de classe.
    this.simulatePayment().then(() =>
      this.orders
        .placeOrder({ lines, deliveryType: v.deliveryType, shippingAddress })
        .subscribe({
          next: () => {
            this.cart.clear();
            this.processing.set(false);
            this.toast.show(
              $localize`:@@checkout.success:Paiement (démo) accepté — commande confirmée !`,
              'success',
            );
            this.router.navigateByUrl('/mon-compte/commandes');
          },
          error: () => {
            this.processing.set(false);
            this.toast.show(
              $localize`:@@checkout.error:Le paiement a échoué. Veuillez réessayer.`,
              'error',
            );
          },
        }),
    );
  }

  /** Simule la latence d'un fournisseur de paiement (700 ms). */
  private simulatePayment(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 700));
  }
}
