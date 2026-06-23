import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { OrderService } from '../../core/services/order.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { createAddressFormController } from '../../core/services/address-form.controller';
import { DeliveryType, PaymentInstructions } from '../../core/models/order.model';
import { formatFeetInches } from '../mesurer/util/feet-inches.util';
import { AddressAutocompleteComponent } from '../../shared/components/a11y-components/autocomplete/address-autocomplete.component';
import { AddressChoiceComponent } from '../../shared/components/a11y-components/address-choice/address-choice.component';
import { GuestContactComponent } from '../../shared/components/a11y-components/guest-contact/guest-contact.component';
import {
  ADDRESS_LINE_PATTERN,
  POSTAL_PATTERN,
  PROVINCES,
  normalizePostal,
  splitAddressLine,
} from '../../core/validators/address.validators';
import {
  buildGuestContactGroup,
  toGuestContactRequest,
} from '../../core/validators/guest-contact.validators';

/** Adresse requise uniquement si le mode de réception est « Livraison ». */
function addressRequiredIfDelivery(g: AbstractControl): ValidationErrors | null {
  if (g.get('deliveryType')?.value !== 'Delivery') return null;
  // EPIC 15 — champ unifié `addressLine1` (n° + rue) ; plus de `civicNumber` séparé.
  const missing = ['addressLine1', 'city', 'postalCode'].some(
    k => !(g.get(k)?.value ?? '').trim(),
  );
  return missing ? { addressRequired: true } : null;
}

/**
 * Caisse — AbrisTempo Local.
 *
 * PAIEMENT PAR VIREMENT INTERAC (e-Transfer) — moyen de paiement RÉEL de production (EPIC 7).
 * Le client passe sa commande (POST /orders → 201), puis la caisse bascule sur l'étape
 * « instructions » : référence, courriel destinataire, montant et marche à suivre du virement.
 * Aucune redirection automatique : le client doit lire et exécuter le virement. La réconciliation
 * (confirmation du paiement reçu) est faite plus tard par l'administration.
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

  protected readonly items = this.cart.items;
  protected readonly shelterItems = this.cart.shelterItems;
  protected readonly subtotal = this.cart.subtotal;
  protected readonly count = this.cart.count;
  /** Vide seulement si AUCUN produit NI abri configuré (EPIC 9.4). */
  protected readonly isEmpty = computed(
    () => this.items().length === 0 && this.shelterItems().length === 0,
  );
  protected readonly processing = signal(false);

  /** Étape du tunnel : saisie du formulaire, puis instructions de virement (EPIC 7). */
  protected readonly step = signal<'form' | 'instructions'>('form');
  /** Instructions de virement Interac renvoyées par le serveur à la création de la commande. */
  protected readonly paymentInstructions = signal<PaymentInstructions | null>(null);

  /**
   * Titre du panneau d'instructions — cible de focus à l'arrivée sur l'étape (WCAG 2.4.3).
   * Rendu INCONDITIONNELLEMENT dès que `step === 'instructions'` : le `<h2 #instructionsHeading>`
   * est placé hors du `@if (paymentInstructions())` interne (seul le `<dl>` des valeurs y reste),
   * pour que l'effet de focus trouve toujours sa cible. Focusé APRÈS rendu via l'effet ci-dessous,
   * jamais dans le tick du `set()` (L-006).
   */
  private readonly instructionsHeading =
    viewChild<ElementRef<HTMLElement>>('instructionsHeading');

  constructor() {
    // Focus du titre du panneau d'instructions une fois qu'il est rendu (L-006) : le `viewChild`
    // ne se résout qu'au rendu suivant le passage `step='instructions'`.
    effect(() => {
      const heading = this.instructionsHeading();
      if (this.step() === 'instructions' && heading) {
        heading.nativeElement.focus();
      }
    });
  }

  protected formatFeetInches = formatFeetInches;
  /** Provinces/territoires pour le `<select>` (code 2 lettres canonique, L-011). */
  protected readonly provinces = PROVINCES;

  /** Visiteur non connecté : on affiche et exige le bloc « coordonnées invité » (Épic F). */
  protected readonly isGuest = computed(() => !this.auth.isAuthenticated());

  /** Coordonnées invité — uniquement utilisées et validées quand `isGuest()`. */
  protected readonly guestForm = buildGuestContactGroup(this.fb);

  protected readonly form = this.fb.nonNullable.group(
    {
      deliveryType: ['Pickup' as DeliveryType, Validators.required],
      // Champ unifié « n° et rue » (EPIC 15). Le motif exige un numéro en tête quand la ligne est
      // remplie (miroir serveur `CivicNumber.NotEmpty()`) ; vide = toléré par le motif et géré par
      // le validateur de groupe `addressRequiredIfDelivery`.
      addressLine1: ['', Validators.pattern(ADDRESS_LINE_PATTERN)],
      apartment: [''],
      city: [''],
      province: ['QC'],
      postalCode: ['', Validators.pattern(POSTAL_PATTERN)],
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
    // Lignes d'abris configurés (EPIC 9.4) : { slug, lengthCm, clearHeightCm, quantity } — AUCUN prix
    // (le serveur recalcule via ShelterPriceCalculator, source unique L-004). La hauteur dégagée est un
    // vrai choix client : transmise et validée serveur (∈ options du modèle), sinon elle serait perdue
    // au passage de commande. La largeur reste implicite au slug. Omis si vide.
    const shelterLines = this.shelterItems().map(s => ({
      slug: s.slug,
      lengthCm: s.lengthCm,
      clearHeightCm: s.clearHeightCm,
      quantity: s.quantity,
    }));
    // EPIC 15 (voie B1) — le `AddressDto` serveur reste découpé : on scinde la ligne unifiée en
    // n° + rue à l'envoi, sans toucher le domaine (aucune migration EF).
    const { civicNumber, street } = splitAddressLine(v.addressLine1);
    const shippingAddress =
      v.deliveryType === 'Delivery'
        ? {
            civicNumber,
            street,
            apartment: v.apartment.trim() || null,
            city: v.city,
            province: v.province || 'QC',
            postalCode: normalizePostal(v.postalCode),
            country: 'Canada',
          }
        : null;

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
        next: response => {
          this.cart.clear();
          this.processing.set(false);
          // Commande enregistrée : on présente les instructions de virement Interac. AUCUNE
          // redirection automatique — le client doit lire et exécuter le virement (EPIC 7).
          this.paymentInstructions.set(response.payment);
          this.step.set('instructions');
          this.toast.show(
            $localize`:@@checkout.success:Commande enregistrée — suivez les instructions de virement Interac pour la régler.`,
            'success',
          );
        },
        error: () => {
          this.processing.set(false);
          this.toast.show(
            $localize`:@@checkout.error:L'enregistrement de la commande a échoué. Veuillez réessayer.`,
            'error',
          );
        },
      });
  }
}
