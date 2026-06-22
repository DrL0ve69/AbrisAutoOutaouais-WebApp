import { render, screen, waitFor, within } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { of } from 'rxjs';
import { registerLocaleData } from '@angular/common';
import localeFrCa from '@angular/common/locales/fr-CA';
import { AdminCalendarComponent } from './calendar';
import { CalendarService } from '../../../core/services/calendar.service';
import { ToastService } from '../../../core/services/toast.service';
import { CalendarBookingDto } from '../../../core/models/calendar.model';
import { expectNoA11yViolations } from '../../../../testing/axe-helper';

registerLocaleData(localeFrCa);

// On épingle la date système : le calendrier ouvre sur le mois courant.
const FIXED_NOW = new Date(2026, 6, 15, 12, 0, 0); // 15 juillet 2026, mardi

const julyBookings: CalendarBookingDto[] = [
  {
    id: 'b1',
    slotStart: '2026-07-08T14:00:00Z',
    slotEnd: '2026-07-08T16:00:00Z',
    type: 'Installation',
    status: 'Pending',
    customerName: 'Camille Client',
    city: 'Gatineau',
  },
  {
    id: 'b2',
    slotStart: '2026-07-08T18:00:00Z',
    slotEnd: '2026-07-08T20:00:00Z',
    type: 'Delivery',
    status: 'Confirmed',
    customerName: 'Benoît Acheteur',
    city: 'Hull',
  },
];

async function setup(bookings: CalendarBookingDto[] = julyBookings) {
  const getCalendar = vi.fn().mockReturnValue(of(bookings));
  const calendarStub: Partial<CalendarService> = { getCalendar };
  const toastStub: Partial<ToastService> = { show: vi.fn() };

  const rendered = await render(AdminCalendarComponent, {
    providers: [
      provideRouter([]),
      { provide: CalendarService, useValue: calendarStub },
      { provide: ToastService, useValue: toastStub },
    ],
  });
  return { ...rendered, getCalendar };
}

describe('AdminCalendarComponent', () => {
  // On ne fake QUE Date (pour ancrer « aujourd'hui ») : laisser setTimeout réel évite de
  // bloquer axe-core, qui planifie des timers en interne (sinon timeout sur le scan WCAG).
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
  });

  // CRITIQUE : restaurer le vrai Date après CHAQUE test. En mode navigateur vitest, les
  // fichiers de spec partagent le worker ; un Date figé qui fuit gèle Date.now() pour les
  // specs suivants → leurs waitFor/timeouts ne s'écoulent plus et échouent de façon
  // intermittente (contamination inter-fichiers, famille L-010/L-019).
  afterEach(() => {
    vi.useRealTimers();
  });

  it('affiche la grille du mois et charge les réservations de la fenêtre', async () => {
    const { getCalendar } = await setup();

    // La grille est rendue (role="grid").
    expect(screen.getByRole('grid')).toBeInTheDocument();
    // Le service a été appelé avec une fenêtre (from/to en YYYY-MM-DD).
    expect(getCalendar).toHaveBeenCalledTimes(1);
    const [from, to] = getCalendar.mock.calls[0];
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // La cellule du 8 juillet annonce 2 rendez-vous (aria-label).
    const cell8 = screen.getByRole('gridcell', { name: /8 juillet.*2 rendez-vous/i });
    expect(cell8).toBeInTheDocument();
  });

  it('une seule cellule est dans l’ordre de tabulation (roving tabindex)', async () => {
    await setup();

    const focusable = screen
      .getAllByRole('gridcell')
      .filter((btn) => btn.getAttribute('tabindex') === '0');

    expect(focusable).toHaveLength(1);
  });

  it('flèche droite déplace la cellule active ET le focus ensemble (grid APG, L-015)', async () => {
    const user = userEvent.setup();
    await setup();

    // La cellule active initiale = aujourd'hui (15 juillet).
    const active = screen
      .getAllByRole('gridcell')
      .find((btn) => btn.getAttribute('tabindex') === '0')!;
    active.focus();
    expect(active).toHaveFocus();
    const activeKey = (active as HTMLElement).dataset['key'];

    await user.keyboard('{ArrowRight}');

    // Une AUTRE cellule (jour suivant) est désormais active ET focalisée.
    const newActive = screen
      .getAllByRole('gridcell')
      .find((btn) => btn.getAttribute('tabindex') === '0')!;
    expect((newActive as HTMLElement).dataset['key']).not.toBe(activeKey);
    await waitFor(() => expect(newActive).toHaveFocus());
  });

  it('la bascule de vue est un radiogroup et change de granularité', async () => {
    const user = userEvent.setup();
    const { getCalendar } = await setup();

    const weekRadio = screen.getByRole('radio', { name: 'Semaine' });
    await user.click(weekRadio);

    expect(weekRadio).toHaveAttribute('aria-checked', 'true');
    // Un nouveau chargement est déclenché par le changement de vue.
    expect(getCalendar.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('ouvre le panneau « RDV du jour » au clic, y déplace le focus, le ferme et rend le focus', async () => {
    const user = userEvent.setup();
    await setup();

    const cell8 = screen.getByRole('gridcell', {
      name: /8 juillet.*2 rendez-vous/i,
    }) as HTMLElement;
    await user.click(cell8);

    const panel = await screen.findByRole('region', { name: /8 juillet.*2 rendez-vous/i });
    await waitFor(() => expect(panel).toHaveFocus());

    // Le panneau liste les 2 RDV (lecture seule) avec leurs clients.
    expect(within(panel).getByText('Camille Client')).toBeInTheDocument();
    expect(within(panel).getByText('Benoît Acheteur')).toBeInTheDocument();

    // Fermeture → retour du focus à la cellule déclencheuse (WCAG 2.4.3).
    await user.click(within(panel).getByRole('button', { name: /fermer le détail du jour/i }));
    await waitFor(() => expect(cell8).toHaveFocus());
  });

  it('ne présente aucune violation WCAG (grille + panneau ouvert)', async () => {
    const user = userEvent.setup();
    const { container } = await setup();

    await screen.findByRole('grid');
    await expectNoA11yViolations(container);

    const cell8 = screen.getByRole('gridcell', {
      name: /8 juillet.*2 rendez-vous/i,
    }) as HTMLElement;
    await user.click(cell8);
    await screen.findByRole('region', { name: /8 juillet/i });
    await expectNoA11yViolations(container);
  });
});
