import { render, screen, waitFor } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { registerLocaleData } from '@angular/common';
import localeFrCa from '@angular/common/locales/fr-CA';
import { AdminBookingsComponent } from './bookings';
import { AdminBookingService } from '../../../core/services/admin-booking.service';
import { ToastService } from '../../../core/services/toast.service';
import { AdminBookingDto } from '../../../core/models/booking.model';
import { expectNoA11yViolations } from '../../../../testing/axe-helper';

// La page affiche des dates (DatePipe) en 'fr-CA'.
registerLocaleData(localeFrCa);

const pendingBooking: AdminBookingDto = {
  id: 'b1',
  customerName: 'Camille Client',
  customerEmail: 'camille@test.com',
  slotStart: '2026-07-06T12:00:00Z',
  slotEnd: '2026-07-06T14:00:00Z',
  type: 'Installation',
  status: 'Pending',
  addressSummary: '123 rue des Érables, Gatineau',
  createdAt: '2026-06-01T15:00:00Z',
};

const confirmedBooking: AdminBookingDto = {
  id: 'b2',
  customerName: 'Benoît Acheteur',
  customerEmail: 'benoit@test.com',
  slotStart: '2026-07-07T14:00:00Z',
  slotEnd: '2026-07-07T16:00:00Z',
  type: 'Delivery',
  status: 'Confirmed',
  addressSummary: '45 boulevard du Plateau, Hull',
  createdAt: '2026-06-02T15:00:00Z',
};

async function setup(bookings: AdminBookingDto[] = [pendingBooking, confirmedBooking]) {
  const updateStatus = vi.fn().mockReturnValue(of(undefined));
  const adminStub: Partial<AdminBookingService> = {
    getAllBookings: () => of(bookings),
    updateStatus,
  };
  const toastStub: Partial<ToastService> = { show: vi.fn() };

  const rendered = await render(AdminBookingsComponent, {
    providers: [
      provideRouter([]),
      { provide: AdminBookingService, useValue: adminStub },
      { provide: ToastService, useValue: toastStub },
    ],
  });
  return { ...rendered, updateStatus };
}

describe('AdminBookingsComponent', () => {
  it('affiche les réservations avec les actions propres à leur statut', async () => {
    await setup();

    expect(await screen.findByText('Camille Client')).toBeInTheDocument();
    // Pending → Confirmer + Annuler
    expect(
      screen.getByRole('button', { name: /confirmer — camille client/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /annuler — camille client/i }),
    ).toBeInTheDocument();
    // Confirmed → Marquer complétée + Annuler
    expect(
      screen.getByRole('button', { name: /marquer complétée — benoît acheteur/i }),
    ).toBeInTheDocument();
  });

  it('déplace le focus dans la boîte de dialogue à l’ouverture (WCAG 2.4.3)', async () => {
    const user = userEvent.setup();
    await setup();

    await user.click(
      await screen.findByRole('button', { name: /confirmer — camille client/i }),
    );

    const dialog = await screen.findByRole('alertdialog');
    await waitFor(() => expect(dialog).toHaveFocus());
  });

  it('applique la transition après confirmation, met le statut à jour et déplace le focus au titre', async () => {
    const user = userEvent.setup();
    const { updateStatus } = await setup();

    await user.click(
      await screen.findByRole('button', { name: /confirmer — camille client/i }),
    );
    await screen.findByRole('alertdialog');

    await user.click(screen.getByRole('button', { name: /confirmer l.action/i }));

    expect(updateStatus).toHaveBeenCalledWith('b1', 'confirm');
    // Le statut passe à « Confirmée » : la ligne expose maintenant l'action
    // « Marquer complétée » et l'ancien déclencheur « Confirmer » disparaît.
    // (b2 est déjà « Confirmée » → on attend DEUX badges, pas un.)
    expect(await screen.findAllByText('Confirmée')).toHaveLength(2);
    expect(
      await screen.findByRole('button', { name: /marquer complétée — camille client/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /confirmer — camille client/i }),
    ).not.toBeInTheDocument();
    // Le déclencheur ayant disparu, le focus revient sur le titre de la page (L-006).
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /gestion des réservations/i }),
      ).toHaveFocus(),
    );
  });

  it('referme la confirmation sans agir et rend le focus au déclencheur', async () => {
    const user = userEvent.setup();
    const { updateStatus } = await setup();

    const trigger = await screen.findByRole('button', {
      name: /annuler — camille client/i,
    });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: /retour à la liste/i }));

    expect(updateStatus).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    // Retour du focus sur le bouton déclencheur (WCAG 2.4.3).
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('ne présente aucune violation WCAG (table + dialogue ouvert)', async () => {
    const user = userEvent.setup();
    const { container } = await setup();

    await screen.findByText('Camille Client');
    await expectNoA11yViolations(container);

    await user.click(screen.getByRole('button', { name: /confirmer — camille client/i }));
    await screen.findByRole('alertdialog');
    await expectNoA11yViolations(container);
  });
});
