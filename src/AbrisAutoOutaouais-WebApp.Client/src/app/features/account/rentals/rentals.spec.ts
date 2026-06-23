import { render, screen, waitFor } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { registerLocaleData } from '@angular/common';
import localeFrCa from '@angular/common/locales/fr-CA';
import { RentalsComponent } from './rentals';
import { RentalService } from '../../../core/services/rental.service';
import { ToastService } from '../../../core/services/toast.service';
import { RentalSummaryDto } from '../../../core/models/rental.model';
import { expectNoA11yViolations } from '../../../../testing/axe-helper';

// La page affiche dates (DatePipe) et montants (CurrencyPipe) en 'fr-CA'.
registerLocaleData(localeFrCa);

const activeRental: RentalSummaryDto = {
  id: 'r1',
  productName: 'Abri simple Tempo',
  monthlyRate: 49,
  startDate: '2026-07-01',
  endDate: '2026-10-01',
  status: 'Active',
};

async function setup(rentals: RentalSummaryDto[] = [activeRental]) {
  const cancel = vi.fn().mockReturnValue(of(undefined));
  const rentalStub: Partial<RentalService> = {
    getMyRentals: () => of(rentals),
    cancel,
  };
  const toastStub: Partial<ToastService> = { show: vi.fn() };

  const rendered = await render(RentalsComponent, {
    providers: [
      provideRouter([]),
      { provide: RentalService, useValue: rentalStub },
      { provide: ToastService, useValue: toastStub },
    ],
  });
  return { ...rendered, cancel };
}

describe('RentalsComponent', () => {
  it('affiche une location active avec un bouton « Annuler »', async () => {
    await setup();

    expect(await screen.findByText('Abri simple Tempo')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /annuler la location/i }),
    ).toBeInTheDocument();
  });

  it('affiche « En attente de paiement » et aucun bouton « Annuler » pour un contrat PendingPayment (EPIC 7.2)', async () => {
    const pending: RentalSummaryDto = { ...activeRental, id: 'r9', status: 'PendingPayment' };
    await setup([pending]);

    expect(await screen.findByText(/en attente de paiement/i)).toBeInTheDocument();
    // Seul un contrat « Active » est annulable côté client → pas de bouton ici.
    expect(
      screen.queryByRole('button', { name: /annuler la location/i }),
    ).not.toBeInTheDocument();
  });

  it('déplace le focus dans la boîte de dialogue à l’ouverture (WCAG 2.4.3)', async () => {
    const user = userEvent.setup();
    await setup();

    await user.click(await screen.findByRole('button', { name: /annuler la location/i }));

    const dialog = await screen.findByRole('alertdialog');
    await waitFor(() => expect(dialog).toHaveFocus());
  });

  it('annule la location après confirmation, met le statut à « Annulée » et déplace le focus au titre', async () => {
    const user = userEvent.setup();
    const { cancel } = await setup();

    await user.click(await screen.findByRole('button', { name: /annuler la location/i }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /confirmer l.annulation/i }));

    expect(cancel).toHaveBeenCalledWith('r1');
    expect(await screen.findByText('Annulée')).toBeInTheDocument();
    // Le bouton d'annulation disparaît une fois la location annulée.
    expect(
      screen.queryByRole('button', { name: /annuler la location/i }),
    ).not.toBeInTheDocument();
    // Le déclencheur ayant disparu, le focus revient sur le titre de la page (repli).
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /mes locations/i })).toHaveFocus(),
    );
  });

  it('ferme la confirmation sans annuler et rend le focus au déclencheur au clic sur « Garder »', async () => {
    const user = userEvent.setup();
    const { cancel } = await setup();

    const trigger = await screen.findByRole('button', { name: /annuler la location/i });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: /garder la location/i }));

    expect(cancel).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    // Retour du focus sur le bouton déclencheur (WCAG 2.4.3).
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('ne présente aucune violation WCAG (liste + dialogue ouvert)', async () => {
    const user = userEvent.setup();
    const { container } = await setup();

    await screen.findByText('Abri simple Tempo');
    await expectNoA11yViolations(container);

    await user.click(screen.getByRole('button', { name: /annuler la location/i }));
    await screen.findByRole('alertdialog');
    await expectNoA11yViolations(container);
  });
});
