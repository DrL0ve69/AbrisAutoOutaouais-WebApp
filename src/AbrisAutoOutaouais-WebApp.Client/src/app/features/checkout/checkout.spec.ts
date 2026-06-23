import { render, screen, waitFor } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { registerLocaleData } from '@angular/common';
import localeFrCa from '@angular/common/locales/fr-CA';
import { signal } from '@angular/core';
import { CheckoutComponent } from './checkout';
import { CartService } from '../../core/services/cart.service';
import { OrderService } from '../../core/services/order.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { PlaceOrderResponse } from '../../core/models/order.model';
import { expectNoA11yViolations } from '../../../testing/axe-helper';

// La caisse affiche montants (CurrencyPipe) en 'fr-CA'.
registerLocaleData(localeFrCa);

const PRODUCT = {
  id: 'p1',
  name: 'Abri simple Tempo 10x20',
  slug: 'abri-simple',
  description: 'Abri robuste.',
  price: 599.99,
  rentalPrice: 49.99,
  stock: 12,
  isAvailable: true,
  categoryName: 'Abris simples',
  thumbnailUrl: null,
  imageUrls: [],
};

const PAYMENT_RESPONSE: PlaceOrderResponse = {
  id: 'order-1',
  payment: {
    reference: 'CMD-ABCD-1234',
    recipientEmail: 'paiements@abristempo.ca',
    amount: 599.99,
    instructions:
      'Ouvrez votre application bancaire, choisissez « Virement Interac » et utilisez la référence.',
  },
};

interface Overrides {
  readonly placeOrderResult?: ReturnType<OrderService['placeOrder']>;
}

async function setup(overrides: Overrides = {}) {
  const placeOrder = vi.fn().mockReturnValue(overrides.placeOrderResult ?? of(PAYMENT_RESPONSE));
  const clear = vi.fn();

  const cartStub: Partial<CartService> = {
    items: signal([{ product: PRODUCT, quantity: 1 }]) as unknown as CartService['items'],
    shelterItems: signal([]) as unknown as CartService['shelterItems'],
    subtotal: signal(599.99) as unknown as CartService['subtotal'],
    count: signal(1) as unknown as CartService['count'],
    clear,
  };
  const orderStub: Partial<OrderService> = { placeOrder };
  const toastStub: Partial<ToastService> = { show: vi.fn() };
  // Connecté → pas de bloc invité ; la livraison n'est pas exercée (réception « Ramassage »),
  // donc le bloc adresse (et son chargement de profil HTTP) n'est jamais rendu.
  const authStub: Partial<AuthService> = {
    isAuthenticated: (() => true) as AuthService['isAuthenticated'],
  };

  const rendered = await render(CheckoutComponent, {
    providers: [
      provideRouter([{ path: '', children: [] }]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: CartService, useValue: cartStub },
      { provide: OrderService, useValue: orderStub },
      { provide: ToastService, useValue: toastStub },
      { provide: AuthService, useValue: authStub },
    ],
  });
  return { ...rendered, placeOrder, clear };
}

describe('CheckoutComponent — paiement par virement Interac (EPIC 7)', () => {
  it('NE présente AUCUN champ de carte (paiement carte simulé retiré)', async () => {
    await setup();
    await screen.findByRole('button', { name: /passer la commande/i });

    // Aucun libellé de carte ne subsiste.
    expect(screen.queryByLabelText(/nom sur la carte/i)).toBeNull();
    expect(screen.queryByLabelText(/numéro de carte/i)).toBeNull();
    expect(screen.queryByLabelText(/cvc/i)).toBeNull();
    // Aucune mention « démo » / « simulation » dans le tunnel.
    expect(screen.queryByText(/démonstration/i)).toBeNull();
    expect(screen.queryByText(/fictive/i)).toBeNull();
  });

  it('après commande, affiche le panneau d’instructions Interac (référence, courriel, montant)', async () => {
    const user = userEvent.setup();
    const { placeOrder, clear } = await setup();

    await user.click(await screen.findByRole('button', { name: /passer la commande/i }));

    expect(placeOrder).toHaveBeenCalledTimes(1);
    expect(clear).toHaveBeenCalledTimes(1);

    // Le panneau e-Transfer est rendu avec les trois informations clés.
    await screen.findByRole('heading', { name: /réglez votre commande par virement interac/i });
    expect(screen.getByText('CMD-ABCD-1234')).toBeInTheDocument();
    expect(screen.getByText('paiements@abristempo.ca')).toBeInTheDocument();
    // Le formulaire de saisie a disparu (le bouton « Passer la commande » n’est plus là).
    expect(screen.queryByRole('button', { name: /passer la commande/i })).toBeNull();
  });

  it('déplace le focus sur le titre du panneau d’instructions après rendu (WCAG 2.4.3, L-006)', async () => {
    const user = userEvent.setup();
    await setup();

    await user.click(await screen.findByRole('button', { name: /passer la commande/i }));

    const heading = await screen.findByRole('heading', {
      name: /réglez votre commande par virement interac/i,
    });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it('ne présente aucune violation WCAG (formulaire puis panneau d’instructions)', async () => {
    const user = userEvent.setup();
    const { container } = await setup();

    await screen.findByRole('button', { name: /passer la commande/i });
    await expectNoA11yViolations(container);

    await user.click(screen.getByRole('button', { name: /passer la commande/i }));
    await screen.findByRole('heading', { name: /réglez votre commande par virement interac/i });
    await expectNoA11yViolations(container);
  });
});
