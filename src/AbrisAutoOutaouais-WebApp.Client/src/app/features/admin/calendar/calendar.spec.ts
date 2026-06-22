import { render, screen, waitFor, within, fireEvent } from '@testing-library/angular';
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
import {
  CustomerSearchResult,
  DayDetailDto,
  OptimizeRouteResult,
} from '../../../core/models/planning.model';
import { AvailableSlotDto } from '../../../core/models/booking.model';
import { BookingService } from '../../../core/services/booking.service';
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

const slots: AvailableSlotDto[] = [
  { start: '2026-07-08T14:00:00Z', end: '2026-07-08T16:00:00Z' },
  { start: '2026-07-08T16:00:00Z', end: '2026-07-08T18:00:00Z' },
];

const customers: CustomerSearchResult[] = [
  { id: 'c1', fullName: 'Roxane Existante', email: 'roxane@test.com' },
  { id: 'c2', fullName: 'Robert Régulier', email: 'robert@test.com' },
];

// Résultat d'optimisation : un RDV recalé (12:00Z → 08:00 local) + un RDV exclu (sans coords).
const optimizeResult: OptimizeRouteResult = {
  date: '2026-07-08',
  stops: [
    {
      bookingId: 'b1',
      order: 0,
      slotStart: '2026-07-08T12:00:00Z', // 08:00 en America/Toronto (EDT)
      customerName: 'Camille Client',
      city: 'Gatineau',
      legKm: 5.4,
      rescheduled: true,
    },
  ],
  excludedBookingIds: ['b2'],
  totalKm: 5.4,
};

interface SetupOptions {
  isAdmin?: boolean;
  detail?: DayDetailDto;
  upsert?: ReturnType<typeof vi.fn>;
  searchCustomers?: ReturnType<typeof vi.fn>;
  createBooking?: ReturnType<typeof vi.fn>;
  getAvailableSlots?: ReturnType<typeof vi.fn>;
  optimizeRoute?: ReturnType<typeof vi.fn>;
}

async function setup(options: SetupOptions = {}) {
  const isAdmin = options.isAdmin ?? true;
  const getCalendar = vi.fn().mockReturnValue(of(julyBookings));
  const getDayDetail = vi.fn().mockReturnValue(of(options.detail ?? dayDetail));
  const upsertWorkHours = options.upsert ?? vi.fn().mockReturnValue(of({ id: 'wh1' }));
  const searchCustomers = options.searchCustomers ?? vi.fn().mockReturnValue(of(customers));
  const getAvailableSlots = options.getAvailableSlots ?? vi.fn().mockReturnValue(of(slots));
  const createBooking = options.createBooking ?? vi.fn().mockReturnValue(of({ id: 'new-booking' }));
  const optimizeRoute = options.optimizeRoute ?? vi.fn().mockReturnValue(of(optimizeResult));

  const calendarStub: Partial<CalendarService> = { getCalendar };
  const planningStub: Partial<PlanningService> = {
    getDayDetail,
    upsertWorkHours,
    searchCustomers,
    optimizeRoute,
  };
  const bookingStub: Partial<BookingService> = { getAvailableSlots, createBooking };
  const authStub = { isAdmin: signal(isAdmin) } as unknown as AuthService;
  const toastStub: Partial<ToastService> = { show: vi.fn() };

  const rendered = await render(AdminCalendarComponent, {
    providers: [
      provideRouter([]),
      { provide: CalendarService, useValue: calendarStub },
      { provide: PlanningService, useValue: planningStub },
      { provide: BookingService, useValue: bookingStub },
      { provide: AuthService, useValue: authStub },
      { provide: ToastService, useValue: toastStub },
    ],
  });
  return {
    ...rendered,
    getCalendar,
    getDayDetail,
    upsertWorkHours,
    searchCustomers,
    getAvailableSlots,
    createBooking,
    optimizeRoute,
  };
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

  // ── Ajout d'un RDV (US-11.2 p2) ───────────────────────────────────────────
  it('Admin : ouvre le sous-formulaire d’ajout et charge les créneaux du jour', async () => {
    const user = userEvent.setup();
    const { getAvailableSlots } = await setup({ isAdmin: true });

    const dialog = (await openDialog(user)).dialog;
    await user.click(within(dialog).getByRole('button', { name: /\+ ajouter un rdv/i }));

    // Les créneaux libres du SEUL jour ouvert sont demandés (from == to == clé du jour).
    expect(getAvailableSlots).toHaveBeenCalledWith('2026-07-08', '2026-07-08');
    // Le radiogroup des créneaux est rendu avec ses options.
    const slotGroup = within(dialog).getByRole('radiogroup', { name: /créneaux disponibles/i });
    expect(within(slotGroup).getAllByRole('radio').length).toBe(2);
  });

  it('jour SANS créneau libre : le focus atterrit dans le sous-formulaire, pas sur <body> (L-006)', async () => {
    const user = userEvent.setup();
    // getAvailableSlots renvoie [] → la branche radio @else N'EST PAS rendue ; la cible de focus
    // doit rester le titre du sous-formulaire (toujours rendu), sinon le focus tombe sur <body>.
    const getAvailableSlots = vi.fn().mockReturnValue(of<AvailableSlotDto[]>([]));
    const { container } = await setup({ isAdmin: true, getAvailableSlots });

    const dialog = (await openDialog(user)).dialog;
    await user.click(within(dialog).getByRole('button', { name: /\+ ajouter un rdv/i }));

    // Aucun radiogroup de créneau (jour complet) — c'est précisément le chemin réel à couvrir.
    expect(within(dialog).queryByRole('radiogroup', { name: /créneaux disponibles/i })).toBeNull();
    expect(within(dialog).getByText(/aucun créneau disponible/i)).toBeInTheDocument();

    // Le titre du sous-formulaire (cible de focus stable) a reçu le focus → PAS <body>.
    const formTitle = within(dialog).getByRole('heading', { name: /nouveau rendez-vous/i });
    await waitFor(() => expect(formTitle).toHaveFocus());
    // Non-vacuité : prouver que le focus n'est pas resté sur le <body>.
    expect(document.activeElement).not.toBe(document.body);
    // Et qu'il est bien CONTENU dans le dialogue (donc dans le sous-formulaire).
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(container).toBeTruthy();
  });

  it('bascule le mode client en radiogroup APG (flèche → flip + focus, L-015)', async () => {
    const user = userEvent.setup();
    const { container } = await setup({ isAdmin: true });

    const dialog = (await openDialog(user)).dialog;
    await user.click(within(dialog).getByRole('button', { name: /\+ ajouter un rdv/i }));

    const modeGroup = within(dialog).getByRole('radiogroup', { name: /type de client/i });
    const newMode = within(modeGroup).getByRole('radio', { name: /nouveau contact/i });
    const existingMode = within(modeGroup).getByRole('radio', { name: /client existant/i });
    expect(newMode).toHaveAttribute('aria-checked', 'true');

    newMode.focus();
    await user.keyboard('{ArrowRight}');

    expect(existingMode).toHaveAttribute('aria-checked', 'true');
    expect(newMode).toHaveAttribute('aria-checked', 'false');
    await waitFor(() => expect(existingMode).toHaveFocus());
    expect(container).toBeTruthy();
  });

  it('mode « client existant » : recherche débouncée, sélection écrit l’id (L-036)', async () => {
    const user = userEvent.setup();
    const createBooking = vi.fn().mockReturnValue(of({ id: 'b-new' }));
    const { searchCustomers, getDayDetail } = await setup({ isAdmin: true, createBooking });

    const dialog = (await openDialog(user)).dialog;
    await user.click(within(dialog).getByRole('button', { name: /\+ ajouter un rdv/i }));

    // Sélectionner un créneau (1ʳᵉ option).
    const slotGroup = within(dialog).getByRole('radiogroup', { name: /créneaux disponibles/i });
    await user.click(within(slotGroup).getAllByRole('radio')[0]);

    // Passer en mode « client existant » et taper une recherche.
    await user.click(within(dialog).getByRole('radio', { name: /client existant/i }));
    const search = within(dialog).getByRole('searchbox', {
      name: /rechercher un client/i,
    }) as HTMLInputElement;
    // fireEvent.input garantit l'événement `input` natif que l'`(input)` du composant écoute
    // (userEvent.type sous fake-timers Date n'émet pas toujours l'événement attendu ici).
    fireEvent.input(search, { target: { value: 'rox' } });
    // `debounceTime` mesure l'écoulement via l'horloge (Date) du scheduler RxJS. Comme on FIGE
    // Date dans beforeEach, on avance la date au-delà des 250 ms pour que le debounce émette.
    vi.setSystemTime(new Date(FIXED_NOW.getTime() + 400));

    // La recherche (débouncée) est appelée et les résultats apparaissent.
    await waitFor(() => expect(searchCustomers).toHaveBeenCalledWith('rox'), { timeout: 2000 });
    const result = await within(dialog).findByRole('button', { name: /roxane existante/i });
    await user.click(result);

    // Remplir l'adresse minimale requise.
    await user.type(within(dialog).getByRole('textbox', { name: /n° civique/i }), '12');
    await user.type(within(dialog).getByRole('textbox', { name: /rue/i }), 'rue Test');
    await user.type(within(dialog).getByRole('textbox', { name: /ville/i }), 'Gatineau');
    await user.type(within(dialog).getByRole('textbox', { name: /code postal/i }), 'J8X 1A1');

    await user.click(within(dialog).getByRole('button', { name: /créer le rendez-vous/i }));

    await waitFor(() => expect(createBooking).toHaveBeenCalledTimes(1));
    const payload = createBooking.mock.calls[0][0];
    // L'id du client choisi est envoyé en targetCustomerId (pas une recherche inverse par nom).
    expect(payload.targetCustomerId).toBe('c1');
    expect(payload.guestContact).toBeNull();
    expect(payload.slotStart).toBe('2026-07-08T14:00:00Z'); // valeur ISO UTC brute (L-044)
    // Après succès, le détail du jour est rechargé (cohérence des RDV).
    expect(getDayDetail.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('refuse de soumettre sans créneau choisi (validation)', async () => {
    const user = userEvent.setup();
    const createBooking = vi.fn().mockReturnValue(of({ id: 'b' }));
    await setup({ isAdmin: true, createBooking });

    const dialog = (await openDialog(user)).dialog;
    await user.click(within(dialog).getByRole('button', { name: /\+ ajouter un rdv/i }));

    // Aucun créneau sélectionné → submit ne déclenche pas l'appel.
    await user.click(within(dialog).getByRole('button', { name: /créer le rendez-vous/i }));
    expect(createBooking).not.toHaveBeenCalled();
  });

  // ── Optimisation de tournée (US-11.3) ─────────────────────────────────────
  it('Admin : « Optimiser la tournée » appelle le service, annonce et affiche l’ordre + exclus', async () => {
    const user = userEvent.setup();
    const optimizeRoute = vi.fn().mockReturnValue(of(optimizeResult));
    const { getDayDetail } = await setup({ isAdmin: true, optimizeRoute });

    const dialog = (await openDialog(user)).dialog;
    const optimizeBtn = within(dialog).getByRole('button', { name: /optimiser la tournée/i });
    await user.click(optimizeBtn);

    // Le service est appelé avec la clé du jour ouvert.
    await waitFor(() => expect(optimizeRoute).toHaveBeenCalledWith('2026-07-08'));

    // L'ordre optimisé est affiché : l'arrêt recalé montre le client + sa ville (l'assertion sur
    // l'HEURE LOCALE 12:00Z → 08 h est faite en e2e avec fuseau forcé — en vitest le fuseau CI est
    // UTC, l'assertion serait vacueuse, L-044).
    await waitFor(() =>
      expect(within(dialog).getAllByText('Camille Client').length).toBeGreaterThanOrEqual(1),
    );

    // La liste des exclus apparaît (1 RDV sans coordonnées).
    expect(within(dialog).getByText(/1\s*RDV exclus/i)).toBeInTheDocument();

    // Le détail du jour est rechargé après succès (les heures ont changé).
    expect(getDayDetail.mock.calls.length).toBeGreaterThanOrEqual(2);

    // L'annonce live-region (role=status) porte le résumé.
    await waitFor(() =>
      expect(within(dialog).getByText(/Tournée optimisée/i)).toBeInTheDocument(),
    );
  });

  it('le bouton « Optimiser la tournée » est absent s’il n’y a aucun RDV (rien à optimiser)', async () => {
    const user = userEvent.setup();
    const emptyDetail: DayDetailDto = { ...dayDetail, bookings: [] };
    await setup({ isAdmin: true, detail: emptyDetail });

    const dialog = (await openDialog(user)).dialog;
    expect(
      within(dialog).queryByRole('button', { name: /optimiser la tournée/i }),
    ).toBeNull();
  });

  it('Staff : aucun bouton « Optimiser la tournée » (lecture seule)', async () => {
    const user = userEvent.setup();
    await setup({ isAdmin: false });

    const dialog = (await openDialog(user)).dialog;
    expect(
      within(dialog).queryByRole('button', { name: /optimiser la tournée/i }),
    ).toBeNull();
  });

  it('Staff : aucun bouton « Ajouter un RDV » (lecture seule)', async () => {
    const user = userEvent.setup();
    await setup({ isAdmin: false });

    const dialog = (await openDialog(user)).dialog;
    expect(within(dialog).queryByRole('button', { name: /\+ ajouter un rdv/i })).toBeNull();
  });

  it('ne présente aucune violation WCAG (grille + dialogue ouvert, Admin)', async () => {
    const user = userEvent.setup();
    const { container } = await setup({ isAdmin: true });

    await screen.findByRole('grid');
    await expectNoA11yViolations(container);

    const dialog = (await openDialog(user)).dialog;
    await expectNoA11yViolations(container);

    // Scanne aussi le sous-formulaire d'ajout (nouvelle surface : radiogroups, recherche, champs).
    await user.click(within(dialog).getByRole('button', { name: /\+ ajouter un rdv/i }));
    await within(dialog).findByRole('radiogroup', { name: /créneaux disponibles/i });
    await expectNoA11yViolations(container);
  });
});
