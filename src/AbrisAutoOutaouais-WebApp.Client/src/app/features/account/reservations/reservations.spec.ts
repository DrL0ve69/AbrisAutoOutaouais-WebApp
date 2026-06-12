import { render, screen, waitFor } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { registerLocaleData } from '@angular/common';
import localeFrCa from '@angular/common/locales/fr-CA';
import { ReservationsComponent } from './reservations';
import { BookingService } from '../../../core/services/booking.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  AvailableSlotDto,
  BookingSummaryDto,
} from '../../../core/models/booking.model';
import { expectNoA11yViolations } from '../../../../testing/axe-helper';

registerLocaleData(localeFrCa);

const booking: BookingSummaryDto = {
  id: 'b1',
  slotStart: '2026-06-15T14:00:00Z',
  durationMin: 120,
  type: 'Installation',
  status: 'Confirmed',
  city: 'Gatineau',
};

const slots: AvailableSlotDto[] = [
  { start: '2026-06-16T10:00:00Z', end: '2026-06-16T12:00:00Z' },
  { start: '2026-06-16T12:00:00Z', end: '2026-06-16T14:00:00Z' },
];

async function setup(bookings: BookingSummaryDto[] = [booking]) {
  const reschedule = vi.fn().mockReturnValue(of(undefined));
  const bookingStub: Partial<BookingService> = {
    getMyBookings: () => of(bookings),
    getAvailableSlots: () => of(slots),
    reschedule,
  };
  const toastStub: Partial<ToastService> = { show: vi.fn() };

  const rendered = await render(ReservationsComponent, {
    providers: [
      provideRouter([]),
      { provide: BookingService, useValue: bookingStub },
      { provide: ToastService, useValue: toastStub },
    ],
  });
  return { ...rendered, reschedule };
}

describe('ReservationsComponent', () => {
  it('affiche une réservation reportable avec un bouton « Reporter »', async () => {
    await setup();

    expect(await screen.findByText(/Gatineau/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reporter la réservation/i })).toBeInTheDocument();
  });

  it('ouvre la boîte de dialogue et y déplace le focus (WCAG 2.4.3)', async () => {
    const user = userEvent.setup();
    await setup();

    await user.click(await screen.findByRole('button', { name: /reporter la réservation/i }));

    const dialog = await screen.findByRole('alertdialog');
    await waitFor(() => expect(dialog).toHaveFocus());
    // Les créneaux disponibles sont proposés en radios.
    expect(screen.getAllByRole('radio').length).toBeGreaterThan(0);
  });

  it('reporte la réservation sur le créneau choisi et rend le focus au déclencheur', async () => {
    const user = userEvent.setup();
    const { reschedule } = await setup();

    const trigger = await screen.findByRole('button', { name: /reporter la réservation/i });
    await user.click(trigger);

    // Le bouton de confirmation est désactivé tant qu'aucun créneau n'est choisi.
    const confirm = screen.getByRole('button', { name: /confirmer le report/i });
    expect(confirm).toBeDisabled();

    await user.click(screen.getAllByRole('radio')[0]);
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(reschedule).toHaveBeenCalledWith('b1', { newSlotStart: slots[0].start });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('ferme sans reporter au clic sur « Annuler » et rend le focus au déclencheur', async () => {
    const user = userEvent.setup();
    const { reschedule } = await setup();

    const trigger = await screen.findByRole('button', { name: /reporter la réservation/i });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: /^annuler$/i }));

    expect(reschedule).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('ne présente aucune violation WCAG (liste + dialogue ouvert)', async () => {
    const user = userEvent.setup();
    const { container } = await setup();

    await screen.findByText(/Gatineau/);
    await expectNoA11yViolations(container);

    await user.click(screen.getByRole('button', { name: /reporter la réservation/i }));
    await screen.findByRole('alertdialog');
    await expectNoA11yViolations(container);
  });
});
