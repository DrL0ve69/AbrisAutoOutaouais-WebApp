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
import { DeliveryType } from '../../core/models/order.model';

/** Adresse requise uniquement si le mode de réception est « Livraison ». */
function addressRequiredIfDelivery(g: AbstractControl): ValidationErrors | null {
  if (g.get('deliveryType')?.value !== 'Delivery') return null;
  const missing = ['street', 'city', 'postalCode'].some(
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
  imports: [ReactiveFormsModule, CurrencyPipe, RouterLink],
})
export class CheckoutComponent {
  private readonly fb = inject(FormBuilder);
  private readonly cart = inject(CartService);
  private readonly orders = inject(OrderService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly items = this.cart.items;
  protected readonly subtotal = this.cart.subtotal;
  protected readonly count = this.cart.count;
  protected readonly isEmpty = computed(() => this.items().length === 0);
  protected readonly processing = signal(false);

  protected readonly form = this.fb.nonNullable.group(
    {
      deliveryType: ['Pickup' as DeliveryType, Validators.required],
      street: [''],
      city: [''],
      province: ['QC'],
      postalCode: [''],
      cardName: ['', Validators.required],
      cardNumber: ['', [Validators.required, Validators.pattern(/^\d{13,19}$/)]],
      expiry: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/\d{2}$/)]],
      cvc: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]],
    },
    { validators: addressRequiredIfDelivery },
  );

  protected get f() {
    return this.form.controls;
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
            street: v.street,
            city: v.city,
            province: v.province || 'QC',
            postalCode: v.postalCode,
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
