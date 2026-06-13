import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
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
import { PlacesService } from '../../core/services/places.service';
import { DeliveryType } from '../../core/models/order.model';
import { PlaceSuggestionDto } from '../../core/models/place.model';
import { AddressAutocompleteComponent } from '../../shared/components/a11y-components/autocomplete/address-autocomplete.component';
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
  imports: [ReactiveFormsModule, CurrencyPipe, RouterLink, AddressAutocompleteComponent],
})
export class CheckoutComponent {
  private readonly fb = inject(FormBuilder);
  private readonly cart = inject(CartService);
  private readonly orders = inject(OrderService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly profile = inject(ProfileService);
  private readonly places = inject(PlacesService);

  protected readonly items = this.cart.items;
  protected readonly subtotal = this.cart.subtotal;
  protected readonly count = this.cart.count;
  protected readonly isEmpty = computed(() => this.items().length === 0);
  protected readonly processing = signal(false);
  /** Annonce (aria-live) : le code postal vient d'être rempli automatiquement. */
  protected readonly postalAutofilled = signal(false);

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
    // Pré-remplit l'adresse de livraison avec l'adresse par défaut enregistrée
    // (sans écraser une saisie en cours — voir ProfileService.applyDefaultAddress).
    this.profile.ensureLoaded();
    effect(() => this.profile.applyDefaultAddress(this.form));
  }

  protected get f() {
    return this.form.controls;
  }

  /**
   * Choix explicite d'une suggestion d'adresse : patch civic/rue/ville/province
   * INCONDITIONNEL (action utilisateur, hors garde pristine de L-002). On résout le code
   * postal et on le patche normalisé (« A1A 1A1 », L-004), champ resté éditable ; null →
   * aucun patch. `patchValue` re-déclenche le validateur de groupe
   * `addressRequiredIfDelivery` automatiquement (toute valeur descendante le ré-évalue).
   */
  protected onSuggestionSelected(s: PlaceSuggestionDto): void {
    this.postalAutofilled.set(false);
    this.form.patchValue({
      civicNumber: s.civicNumber ?? '',
      street: s.street,
      city: s.city,
      province: s.province || 'QC',
    });
    this.form.controls.street.markAsDirty();

    this.places
      .lookupPostalCode(s.civicNumber ?? '', s.street, s.city, s.province)
      .subscribe({
        next: ({ postalCode }) => {
          if (!postalCode) return;
          this.form.controls.postalCode.setValue(normalizePostal(postalCode));
          this.postalAutofilled.set(true);
        },
        error: () => {
          /* silencieux : saisie manuelle possible */
        },
      });
  }

  /** Frappe libre dans le combobox : synchronise le contrôle « rue ». */
  protected onStreetInput(value: string): void {
    this.form.controls.street.setValue(value);
    this.form.controls.street.markAsDirty();
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
