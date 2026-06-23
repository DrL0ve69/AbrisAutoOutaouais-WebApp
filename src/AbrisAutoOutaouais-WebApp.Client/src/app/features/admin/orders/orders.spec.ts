import { render, screen, waitFor } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { registerLocaleData } from '@angular/common';
import localeFrCa from '@angular/common/locales/fr-CA';
import { AdminOrdersComponent } from './orders';
import { AdminOrderService } from '../../../core/services/admin-order.service';
import { ToastService } from '../../../core/services/toast.service';
import { AdminOrderDto } from '../../../core/models/order.model';
import { expectNoA11yViolations } from '../../../../testing/axe-helper';

// Dates (DatePipe) et montants (CurrencyPipe) en 'fr-CA'.
registerLocaleData(localeFrCa);

// Commande en attente AVEC virement attaché, non encore réconcilié → « Marquer payé » proposé.
const awaitingPayment: AdminOrderDto = {
  id: 'o1',
  reference: 'CMD-0001',
  customerEmail: 'camille@test.com',
  createdAt: '2026-06-01T15:00:00Z',
  status: 'Pending',
  total: 599.99,
  itemCount: 1,
  paymentReference: 'INT-AB12-CD34',
  paymentConfirmedAt: null,
};

// Commande déjà payée → aucun bouton « Marquer payé », badge « Payé » + date.
const alreadyPaid: AdminOrderDto = {
  ...awaitingPayment,
  id: 'o2',
  reference: 'CMD-0002',
  customerEmail: 'benoit@test.com',
  status: 'Confirmed',
  paymentReference: 'INT-EF56-GH78', // référence distincte → findByText non ambigu
  paymentConfirmedAt: '2026-06-02T10:00:00Z',
};

async function setup(orders: AdminOrderDto[] = [awaitingPayment, alreadyPaid]) {
  const confirmPayment = vi.fn().mockReturnValue(of(undefined));
  // Après réconciliation, le composant recharge : on renvoie la commande désormais payée.
  const reloaded: AdminOrderDto = {
    ...awaitingPayment,
    status: 'Confirmed',
    paymentConfirmedAt: '2026-06-03T09:00:00Z',
  };
  const getAllOrders = vi
    .fn()
    .mockReturnValueOnce(of(orders))
    .mockReturnValue(of([reloaded, alreadyPaid]));

  const adminStub: Partial<AdminOrderService> = {
    getAllOrders,
    confirmPayment,
    updateStatus: vi.fn().mockReturnValue(of(undefined)),
  };
  const toastStub: Partial<ToastService> = { show: vi.fn() };

  const rendered = await render(AdminOrdersComponent, {
    providers: [
      provideRouter([]),
      { provide: AdminOrderService, useValue: adminStub },
      { provide: ToastService, useValue: toastStub },
    ],
  });
  return { ...rendered, confirmPayment };
}

describe('AdminOrdersComponent — réconciliation du paiement (EPIC 7)', () => {
  it('affiche la référence de paiement et l’état (en attente vs payé)', async () => {
    await setup();

    expect(await screen.findByText('INT-AB12-CD34')).toBeInTheDocument();
    // La commande payée porte le badge « Payé » (texte exact — « Marquer payé » est un bouton).
    expect(screen.getByText('Payé', { exact: true })).toBeInTheDocument();
    // La commande en attente porte un bouton « Marquer payé » étiqueté avec sa référence.
    expect(
      screen.getByRole('button', { name: /marquer payé — cmd-0001/i }),
    ).toBeInTheDocument();
    // La commande déjà payée n’expose PAS de bouton « Marquer payé ».
    expect(
      screen.queryByRole('button', { name: /marquer payé — cmd-0002/i }),
    ).toBeNull();
  });

  it('clique « Marquer payé » → appelle confirmPayment, recharge et rend le focus au titre (L-006)', async () => {
    const user = userEvent.setup();
    const { confirmPayment } = await setup();

    const button = await screen.findByRole('button', { name: /marquer payé — cmd-0001/i });
    await user.click(button);

    expect(confirmPayment).toHaveBeenCalledWith('o1');
    // Après rechargement, la commande o1 est payée → son bouton « Marquer payé » disparaît.
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /marquer payé — cmd-0001/i }),
      ).toBeNull(),
    );
    // Le déclencheur ayant disparu, le focus revient au titre de la page (cible stable).
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /gestion des commandes/i })).toHaveFocus(),
    );
  });

  it('ne présente aucune violation WCAG (table avec colonne paiement)', async () => {
    const { container } = await setup();
    await screen.findByText('INT-AB12-CD34');
    await expectNoA11yViolations(container);
  });
});
