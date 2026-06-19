import {
  ChangeDetectionStrategy,
  Component,
  computed,
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
import { AuthService } from '../../core/services/auth.service';
import { createAddressFormController } from '../../core/services/address-form.controller';
import { DeliveryType } from '../../core/models/order.model';
import { formatFeetInches } from '../mesurer/util/feet-inches.util';
import { AddressAutocompleteComponent } from '../../shared/components/a11y-components/autocomplete/address-autocomplete.component';
import { AddressChoiceComponent } from '../../shared/components/a11y-components/address-choice/address-choice.component';
import { GuestContactComponent } from '../../shared/components/a11y-components/guest-contact/guest-contact.component';
import { CIVIC_PATTERN, POSTAL_PATTERN, normalizePostal } from '../../core/validators/address.validators';
import {
  buildGuestContactGroup,
  toGuestContactRequest,
} from '../../core/validators/guest-contact.validators';

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
    GuestContactComponent,
  ],
})
export class CheckoutComponent {
  private readonly fb = inject(FormBuilder);
  private readonly cart = inject(CartService);
  private readonly orders = inject(OrderService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly items = this.cart.items;
  protected readonly shelterItems = this.cart.shelterItems;
  protected readonly subtotal = this.cart.subtotal;
  protected readonly count = this.cart.count;
  /** Vide seulement si AUCUN produit NI abri configuré (EPIC 9.4). */
  protected readonly isEmpty = computed(
    () => this.items().length === 0 && this.shelterItems().length === 0,
  );
  protected readonly processing = signal(false);

  protected formatFeetInches = formatFeetInches;

  /** Visiteur non connecté : on affiche et exige le bloc « coordonnées invité » (Épic F). */
  protected readonly isGuest = computed(() => !this.auth.isAuthenticated());

  /** Coordonnées invité — uniquement utilisées et validées quand `isGuest()`. */
  protected readonly guestForm = buildGuestContactGroup(this.fb);

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

  /**
   * Câblage « adresse » mutualisé (pastille profil, recopie force D6, suggestions + code postal).
   * Voir `AddressFormController`. Instancié en initialiseur de champ (pendant la construction) : la
   * fabrique résout elle-même ses dépendances par `inject()`. Le template référence directement
   * `addr.*` (pas de ré-exposition — PR #34, dé-duplication SonarCloud).
   */
  protected readonly addr = createAddressFormController(this.form);

  protected get f() {
    return this.form.controls;
  }

  protected pay(): void {
    if (this.isEmpty() || this.processing()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    // Invité : ses coordonnées sont requises avant de soumettre.
    if (this.isGuest() && this.guestForm.invalid) {
      this.guestForm.markAllAsTouched();
      return;
    }

    this.processing.set(true);
    const v = this.form.getRawValue();
    const guestContact = this.isGuest() ? toGuestContactRequest(this.guestForm) : null;
    const lines = this.items().map(i => ({
      productId: i.product.id,
      quantity: i.quantity,
    }));
    // Lignes d'abris configurés (EPIC 9.4) : { slug, lengthCm, quantity } — AUCUN prix
    // (le serveur recalcule via ShelterPriceCalculator, source unique L-004). Omis si vide.
    const shelterLines = this.shelterItems().map(s => ({
      slug: s.slug,
      lengthCm: s.lengthCm,
      quantity: s.quantity,
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
        .placeOrder({
          lines,
          deliveryType: v.deliveryType,
          shippingAddress,
          guestContact,
          // Omis (undefined) si aucun abri configuré — n'altère pas la charge produit existante.
          shelterLines: shelterLines.length > 0 ? shelterLines : undefined,
        })
        .subscribe({
          next: () => {
            this.cart.clear();
            this.processing.set(false);
            this.toast.show(
              $localize`:@@checkout.success:Paiement (démo) accepté — commande confirmée !`,
              'success',
            );
            // Invité : « mes commandes » est protégé par le garde d'auth (il y serait redirigé
            // vers /auth). On le renvoie à l'accueil ; le connecté va voir sa commande (Épic F).
            this.router.navigateByUrl(this.isGuest() ? '/' : '/mon-compte/commandes');
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
