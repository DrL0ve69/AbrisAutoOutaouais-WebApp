import { render, screen, waitFor } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { registerLocaleData } from '@angular/common';
import localeFrCa from '@angular/common/locales/fr-CA';
import { AdminRentalsComponent } from './rentals';
import { AdminRentalService } from '../../../core/services/admin-rental.service';
import { ToastService } from '../../../core/services/toast.service';
import { AdminRentalDto } from '../../../core/models/rental.model';
import { expectNoA11yViolations } from '../../../../testing/axe-helper';

// La page affiche dates (DatePipe) et montants (CurrencyPipe) en 'fr-CA'.
registerLocaleData(localeFrCa);

const activeRental: AdminRentalDto = {
  id: 'r1',
  customerName: 'Camille Client',
  customerEmail: 'camille@test.com',
  productName: 'Abri simple Tempo',
  monthlyRate: 49,
  startDate: '2026-07-01',
  endDate: '2026-10-01',
  status: 'Active',
  addressSummary: '123 rue des Érables, Gatineau',
  createdAt: '2026-06-01T15:00:00Z',
  paymentReference: 'ABR-ACTIVE-01',
  paymentConfirmedAt: '2026-06-02T10:00:00Z',
};

const expiredRental: AdminRentalDto = {
  ...activeRental,
  id: 'r2',
  customerName: 'Benoît Acheteur',
  customerEmail: 'benoit@test.com',
  status: 'Expired',
};

/** Contrat EN ATTENTE DE PAIEMENT : virement attaché mais non confirmé → bouton « Marquer payé ». */
const pendingRental: AdminRentalDto = {
  ...activeRental,
  id: 'r3',
  customerName: 'Diane Paiement',
  customerEmail: 'diane@test.com',
  status: 'PendingPayment',
  paymentReference: 'ABR-PEND-03',
  paymentConfirmedAt: null,
};

async function setup(rentals: AdminRentalDto[] = [activeRental, expiredRental]) {
  const cancel = vi.fn().mockReturnValue(of(undefined));
  const confirmPayment = vi.fn().mockReturnValue(of(undefined));
  const adminStub: Partial<AdminRentalService> = {
    getAllRentals: () => of(rentals),
    cancel,
    confirmPayment,
  };
  const toastStub: Partial<ToastService> = { show: vi.fn() };

  const rendered = await render(AdminRentalsComponent, {
    providers: [
      provideRouter([]),
      { provide: AdminRentalService, useValue: adminStub },
      { provide: ToastService, useValue: toastStub },
    ],
  });
  return { ...rendered, cancel, confirmPayment };
}

describe('AdminRentalsComponent', () => {
  it('affiche les contrats — seule une location active est annulable', async () => {
    await setup();

    expect(await screen.findByText('Camille Client')).toBeInTheDocument();
    // Active → bouton d'annulation présent.
    expect(
      screen.getByRole('button', { name: /annuler la location .* camille client/i }),
    ).toBeInTheDocument();
    // Expired → aucun bouton.
    expect(
      screen.queryByRole('button', { name: /benoît acheteur/i }),
    ).not.toBeInTheDocument();
  });

  it('déplace le focus dans la boîte de dialogue à l’ouverture (WCAG 2.4.3)', async () => {
    const user = userEvent.setup();
    await setup();

    await user.click(
      await screen.findByRole('button', {
        name: /annuler la location .* camille client/i,
      }),
    );

    const dialog = await screen.findByRole('alertdialog');
    await waitFor(() => expect(dialog).toHaveFocus());
  });

  it('annule après confirmation, met le statut à « Annulée » et déplace le focus au titre', async () => {
    const user = userEvent.setup();
    const { cancel } = await setup();

    await user.click(
      await screen.findByRole('button', {
        name: /annuler la location .* camille client/i,
      }),
    );
    await screen.findByRole('alertdialog');

    await user.click(screen.getByRole('button', { name: /confirmer l.annulation/i }));

    expect(cancel).toHaveBeenCalledWith('r1');
    expect(await screen.findByText('Annulée')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /annuler la location .* camille client/i }),
    ).not.toBeInTheDocument();
    // Le déclencheur ayant disparu, le focus revient sur le titre de la page (L-006).
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /gestion des locations/i })).toHaveFocus(),
    );
  });

  it('referme la confirmation sans annuler et rend le focus au déclencheur', async () => {
    const user = userEvent.setup();
    const { cancel } = await setup();

    const trigger = await screen.findByRole('button', {
      name: /annuler la location .* camille client/i,
    });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: /garder la location/i }));

    expect(cancel).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('affiche « Marquer payé » uniquement pour un contrat PendingPayment et réconcilie le paiement (EPIC 7.2)', async () => {
    const user = userEvent.setup();
    // r3 (PendingPayment) → bouton présent ; r1 (Active, déjà payé) → pas de bouton.
    const { confirmPayment } = await setup([pendingRental, activeRental]);

    expect(await screen.findByText('Diane Paiement')).toBeInTheDocument();
    // L'aria-label porte la référence (L-024).
    const markPaid = screen.getByRole('button', { name: /marquer payé — abr-pend-03/i });
    expect(markPaid).toBeInTheDocument();
    // Active déjà payé → pas de bouton « Marquer payé » pour Camille.
    expect(
      screen.queryByRole('button', { name: /marquer payé — abr-active-01/i }),
    ).not.toBeInTheDocument();

    await user.click(markPaid);
    expect(confirmPayment).toHaveBeenCalledWith('r3');
  });

  it('affiche l’état du paiement : « Payé » + date pour un contrat confirmé, « En attente » sinon', async () => {
    await setup([pendingRental, activeRental]);

    await screen.findByText('Diane Paiement');
    // Référence du virement affichée pour les deux.
    expect(screen.getByText('ABR-PEND-03')).toBeInTheDocument();
    expect(screen.getByText('ABR-ACTIVE-01')).toBeInTheDocument();
    // Badge « Payé » pour le contrat confirmé, « En attente » pour le PendingPayment.
    expect(screen.getByText(/^payé$/i)).toBeInTheDocument();
    expect(screen.getByText(/^en attente$/i)).toBeInTheDocument();
  });

  it('ne présente aucune violation WCAG (table + dialogue ouvert)', async () => {
    const user = userEvent.setup();
    const { container } = await setup();

    await screen.findByText('Camille Client');
    await expectNoA11yViolations(container);

    await user.click(
      screen.getByRole('button', { name: /annuler la location .* camille client/i }),
    );
    await screen.findByRole('alertdialog');
    await expectNoA11yViolations(container);
  });
});
