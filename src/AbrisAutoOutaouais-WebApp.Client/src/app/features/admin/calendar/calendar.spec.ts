import { render, screen, waitFor, within } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeFrCa from '@angular/common/locales/fr-CA';
import { AdminCalendarComponent } from './calendar';
import { CalendarService } from '../../../core/services/calendar.service';
import { PlanningService } from '../../../core/services/planning.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { CalendarBookingDto } from '../../../core/models/calendar.model';
import { DayDetailDto } from '../../../core/models/planning.model';
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

const dayDetail: DayDetailDto = {
  date: '2026-07-08',
  bookings: julyBookings,
  staff: [
    {
      employeeId: 's1',
      fullName: 'Sam Staff',
      startMinutes: 480, // 08:00
      endMinutes: 1020, // 17:00
      note: 'Quart du matin',
      hasEntry: true,
    },
    {
      employeeId: 's2',
      fullName: 'Nadia Nouvelle',
      startMinutes: null,
      endMinutes: null,
      note: null,
      hasEntry: false,
    },
  ],
};

interface SetupOptions {
  isAdmin?: boolean;
  detail?: DayDetailDto;
  upsert?: ReturnType<typeof vi.fn>;
}

async function setup(options: SetupOptions = {}) {
  const isAdmin = options.isAdmin ?? true;
  const getCalendar = vi.fn().mockReturnValue(of(julyBookings));
  const getDayDetail = vi.fn().mockReturnValue(of(options.detail ?? dayDetail));
  const upsertWorkHours = options.upsert ?? vi.fn().mockReturnValue(of({ id: 'wh1' }));

  const calendarStub: Partial<CalendarService> = { getCalendar };
  const planningStub: Partial<PlanningService> = { getDayDetail, upsertWorkHours };
  const authStub = { isAdmin: signal(isAdmin) } as unknown as AuthService;
  const toastStub: Partial<ToastService> = { show: vi.fn() };

  const rendered = await render(AdminCalendarComponent, {
    providers: [
      provideRouter([]),
      { provide: CalendarService, useValue: calendarStub },
      { provide: PlanningService, useValue: planningStub },
      { provide: AuthService, useValue: authStub },
      { provide: ToastService, useValue: toastStub },
    ],
  });
  return { ...rendered, getCalendar, getDayDetail, upsertWorkHours };
}

/** Ouvre le dialogue du 8 juillet (cellule porteuse des RDV mockés). */
async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  const cell8 = screen.getByRole('gridcell', { name: /8 juillet.*2 rendez-vous/i }) as HTMLElement;
  await user.click(cell8);
  const dialog = await screen.findByRole('dialog');
  return { cell8, dialog };
}

describe('AdminCalendarComponent', () => {
  // On ne fake QUE Date (pour ancrer « aujourd'hui ») : laisser setTimeout réel évite de
  // bloquer axe-core, qui planifie des timers en interne (sinon timeout sur le scan WCAG).
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('affiche la grille du mois et charge les réservations de la fenêtre', async () => {
    const { getCalendar } = await setup();

    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(getCalendar).toHaveBeenCalledTimes(1);
    const [from, to] = getCalendar.mock.calls[0];
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/);

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

    const active = screen
      .getAllByRole('gridcell')
      .find((btn) => btn.getAttribute('tabindex') === '0')!;
    active.focus();
    expect(active).toHaveFocus();
    const activeKey = (active as HTMLElement).dataset['key'];

    await user.keyboard('{ArrowRight}');

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
    expect(getCalendar.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('ouvre le dialogue détail au clic, y déplace le focus, le ferme et rend le focus', async () => {
    const user = userEvent.setup();
    const { getDayDetail } = await setup();

    const { cell8, dialog } = await openDialog(user);
    await waitFor(() => expect(dialog).toHaveFocus());

    // Le détail du jour a été demandé avec la clé locale du jour cliqué.
    expect(getDayDetail).toHaveBeenCalledWith('2026-07-08');

    // Le dialogue liste les 2 RDV avec leurs clients (lecture seule).
    expect(within(dialog).getByText('Camille Client')).toBeInTheDocument();
    expect(within(dialog).getByText('Benoît Acheteur')).toBeInTheDocument();

    // Fermeture → retour du focus à la cellule déclencheuse (WCAG 2.4.3).
    await user.click(within(dialog).getByRole('button', { name: /fermer le détail du jour/i }));
    await waitFor(() => expect(cell8).toHaveFocus());
  });

  it('le dialogue a un nom accessible non vide (date) même via aria-labelledby (L-040)', async () => {
    const user = userEvent.setup();
    await setup();

    const dialog = (await openDialog(user)).dialog;
    // getByRole avec { name } échouerait si le nom était vide.
    expect(dialog).toHaveAccessibleName(/8 juillet 2026/i);
  });

  it('Admin : un formulaire d’heures par employé ; enregistrer appelle le service', async () => {
    const user = userEvent.setup();
    const { upsertWorkHours } = await setup({ isAdmin: true });

    const dialog = (await openDialog(user)).dialog;

    // Le formulaire de Sam Staff (pré-rempli 08:00 / 17:00) est éditable.
    const samGroup = within(dialog).getByRole('group', { name: /heures de sam staff/i });
    expect(samGroup).toBeInTheDocument();

    const saveBtn = within(samGroup).getByRole('button', {
      name: /enregistrer les heures de sam staff/i,
    });
    await user.click(saveBtn);

    await waitFor(() => expect(upsertWorkHours).toHaveBeenCalledTimes(1));
    const req = upsertWorkHours.mock.calls[0][0];
    expect(req).toMatchObject({
      employeeId: 's1',
      date: '2026-07-08',
      startMinutes: 480,
      endMinutes: 1020,
      note: 'Quart du matin',
    });
  });

  it('Staff : les heures sont en lecture seule (aucun champ éditable)', async () => {
    const user = userEvent.setup();
    const { upsertWorkHours } = await setup({ isAdmin: false });

    const dialog = (await openDialog(user)).dialog;

    // Aucun formulaire/groupe d’édition, aucun input.
    expect(within(dialog).queryByRole('group', { name: /heures de/i })).toBeNull();
    expect(within(dialog).queryByRole('textbox')).toBeNull();
    // Mais les heures sont affichées en lecture seule.
    expect(within(dialog).getByText(/08:00\s*–\s*17:00/)).toBeInTheDocument();
    expect(upsertWorkHours).not.toHaveBeenCalled();
  });

  it('ne présente aucune violation WCAG (grille + dialogue ouvert, Admin)', async () => {
    const user = userEvent.setup();
    const { container } = await setup({ isAdmin: true });

    await screen.findByRole('grid');
    await expectNoA11yViolations(container);

    await openDialog(user);
    await expectNoA11yViolations(container);
  });
});
