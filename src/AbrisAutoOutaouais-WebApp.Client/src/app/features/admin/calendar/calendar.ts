import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, map, switchMap, of, catchError } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CalendarService } from '../../../core/services/calendar.service';
import { PlanningService } from '../../../core/services/planning.service';
import { BookingService } from '../../../core/services/booking.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  CalendarBookingDto,
  CalendarCell,
  CalendarView,
} from '../../../core/models/calendar.model';
import {
  CustomerSearchResult,
  DayDetailDto,
  OptimizeRouteResult,
  StaffWorkHoursDto,
} from '../../../core/models/planning.model';
import {
  AvailableSlotDto,
  BookingStatus,
  BookingType,
  CreateBookingRequest,
} from '../../../core/models/booking.model';
import { isRadioNavKey, nextRadioIndex } from '../../mesurer/util/radio-nav.util';
import {
  CIVIC_PATTERN,
  POSTAL_PATTERN,
  normalizePostal,
} from '../../../core/validators/address.validators';
import {
  buildGuestContactGroup,
  toGuestContactRequest,
} from '../../../core/validators/guest-contact.validators';
import { excludedBrandValidator } from '../../../core/validators/brand.validators';
import { GuestContactComponent } from '../../../shared/components/a11y-components/guest-contact/guest-contact.component';
import { hhmmToMinutes, minutesToHhmm } from './util/work-hours.util';
import {
  buildGrid,
  isGridNavKey,
  isoDate,
  nextGridDate,
  shiftPeriod,
  startOfDay,
  viewRange,
} from './util/calendar-grid.util';

/** Mode de saisie du client pour un nouveau RDV (radiogroup APG). */
type AddMode = 'new' | 'existing';

/** Option de la bascule de vue (radiogroup APG). */
interface ViewOption {
  readonly view: CalendarView;
  readonly label: string;
}

/** Formulaire réactif des heures d'un employé (édition Admin). */
type WorkHoursForm = FormGroup<{
  start: FormControl<string>;
  end: FormControl<string>;
  note: FormControl<string>;
}>;

/**
 * Vue planning (US-11.1 + US-11.2) — calendrier des créneaux existants + détail du jour.
 * Cliquer un jour ouvre un DIALOGUE accessible (`role="dialog"`) listant les RDV du jour
 * (lecture seule) ET les heures de chaque employé (Staff). L'Admin saisit/édite les heures
 * (formulaire réactif par employé) ; le Staff voit les heures en lecture seule.
 *
 * US-11.2 p2 — l'Admin peut AJOUTER un RDV depuis le dialogue : un sous-formulaire propose un
 * créneau libre du jour (radiogroup APG des `available-slots`), le client (« Nouveau contact » via
 * `app-guest-contact` + compte express OU « Client existant » par recherche débouncée), l'adresse,
 * le type et la marque/modèle. La soumission envoie `targetCustomerId` (mode existant) OU
 * `guestContact` (nouveau contact), puis recharge le détail du jour ET la grille (cohérence des
 * pastilles). Ajouter un employé reste HORS périmètre (déjà couvert par la saisie d'heures, p1).
 *
 * Accessible au clavier (WCAG 2.2 AA) :
 *  - grille `role="grid"` roving tabindex + flèches/Home/End/PageUp/PageDown (pattern grid APG, L-015) ;
 *  - bascule mois/semaine/jour en `role="radiogroup"` roving ;
 *  - dialogue focalisé à l'ouverture, Échap/fermer rendent le focus à la cellule déclencheuse
 *    (WCAG 2.4.3) — focus déplacé APRÈS rendu (L-006) ; nom accessible TOUJOURS non vide via un
 *    computed portant la date formatée, même avant l'arrivée du détail async (L-040) ;
 *  - live-regions SCOPÉES au composant (pas de role="status" global — L-010), reset neutre avant
 *    ré-annonce d'une même valeur (L-027).
 * Admin ET Staff voient TOUT le calendrier (décision propriétaire ; pas de filtre utilisateur).
 */
@Component({
  selector: 'app-admin-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, ReactiveFormsModule, GuestContactComponent],
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss',
  host: {
    // Échap ferme le dialogue jour ouvert (et rend le focus à la cellule).
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class AdminCalendarComponent {
  private readonly calendar = inject(CalendarService);
  private readonly planning = inject(PlanningService);
  private readonly booking = inject(BookingService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  // ── État ─────────────────────────────────────────────────────────────────
  protected readonly view = signal<CalendarView>('month');
  /** Date d'ancrage de la période affichée (jour local, minuit). */
  protected readonly anchorDate = signal<Date>(startOfDay(new Date()));
  /** Cellule active de la grille (roving tabindex + focus). Clé ISO du jour local. */
  protected readonly focusedDate = signal<Date>(startOfDay(new Date()));
  protected readonly bookings = signal<readonly CalendarBookingDto[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  /** Jour dont le dialogue « détail du jour » est ouvert (null = fermé). */
  protected readonly openDay = signal<CalendarCell | null>(null);
  /** Détail chargé du jour ouvert (RDV + employés) ; null tant que la requête n'a pas répondu. */
  protected readonly dayDetail = signal<DayDetailDto | null>(null);
  protected readonly loadingDetail = signal(false);
  protected readonly detailError = signal(false);
  /** Annonce scopée (changement de période/vue) — vidée puis remplie pour re-déclencher la lecture. */
  protected readonly announcement = signal('');
  /** Annonce scopée de l'état de sauvegarde des heures (reset neutre avant ré-annonce — L-027). */
  protected readonly saveAnnouncement = signal('');

  /** L'utilisateur courant est-il Admin (édition des heures) ? Sinon lecture seule. */
  protected readonly isAdmin = this.auth.isAdmin;

  /** Formulaires d'heures par employé (même ordre que `dayDetail().staff`). */
  protected readonly hoursForms = signal<readonly WorkHoursForm[]>([]);
  /** Employé en cours de sauvegarde (par id) — désactive son bouton et annonce l'état. */
  protected readonly savingEmployeeId = signal<string | null>(null);

  // ── Ajout d'un RDV (US-11.2 p2, Admin) ─────────────────────────────────────
  /** Le sous-formulaire « Ajouter un RDV » est-il déployé ? */
  protected readonly showAddForm = signal(false);
  /** Créneaux libres du jour ouvert (radiogroup APG). */
  protected readonly availableSlots = signal<readonly AvailableSlotDto[]>([]);
  protected readonly loadingSlots = signal(false);
  /** Créneau sélectionné (sa valeur `start` ISO UTC brute — pas de Date locale, L-044). */
  protected readonly selectedSlot = signal<string | null>(null);
  /** Mode de saisie du client : nouveau contact (défaut) ou client existant. */
  protected readonly addMode = signal<AddMode>('new');
  /** Résultats de la recherche de clients (mode existant). */
  protected readonly customerResults = signal<readonly CustomerSearchResult[]>([]);
  protected readonly searchingCustomers = signal(false);
  /** Client existant sélectionné (son id est envoyé en `targetCustomerId` — L-036). */
  protected readonly selectedCustomer = signal<CustomerSearchResult | null>(null);
  protected readonly submittingBooking = signal(false);
  /** Annonce scopée de l'ajout de RDV (reset neutre avant ré-annonce — L-027). */
  protected readonly addAnnouncement = signal('');

  // ── Optimisation de tournée (US-11.3, Admin) ───────────────────────────────
  /** Optimisation en cours (désactive le bouton + annonce l'état). */
  protected readonly optimizing = signal(false);
  /** Dernier résultat d'optimisation du jour ouvert (null = pas encore optimisé). */
  protected readonly optimizeResult = signal<OptimizeRouteResult | null>(null);
  /** Annonce scopée de l'optimisation (reset neutre avant ré-annonce — L-027). */
  protected readonly optimizeAnnouncement = signal('');

  /** Flux de termes de recherche client (poussé par l'`(input)` du champ — mode existant). */
  private readonly customerSearch$ = new Subject<string>();

  protected readonly types: readonly BookingType[] = ['Installation', 'Delivery', 'Removal'];

  /**
   * Formulaire du nouveau RDV (adresse structurée + type + marque/modèle + notes). Le client est
   * géré à part (radiogroup mode + `app-guest-contact` ou recherche). `province` défaut « QC ».
   */
  protected readonly addForm = this.fb.nonNullable.group({
    type: ['Installation' as BookingType, Validators.required],
    civicNumber: ['', [Validators.required, Validators.pattern(CIVIC_PATTERN)]],
    street: ['', Validators.required],
    apartment: ['', Validators.maxLength(20)],
    city: ['', Validators.required],
    province: ['QC', Validators.required],
    postalCode: ['', [Validators.required, Validators.pattern(POSTAL_PATTERN)]],
    brand: ['', [excludedBrandValidator, Validators.maxLength(100)]],
    model: ['', Validators.maxLength(100)],
    notes: [''],
  });

  /** Coordonnées du nouveau contact (mode « new ») — validées seulement dans ce mode. */
  protected readonly guestForm = buildGuestContactGroup(this.fb);

  /** Terme de recherche client (mode « existing »). */
  protected readonly customerSearchTerm = new FormControl('', { nonNullable: true });

  protected get af() {
    return this.addForm.controls;
  }

  protected readonly views: readonly ViewOption[] = [
    { view: 'month', label: $localize`:@@admin.calendar.view.month:Mois` },
    { view: 'week', label: $localize`:@@admin.calendar.view.week:Semaine` },
    { view: 'day', label: $localize`:@@admin.calendar.view.day:Jour` },
  ];

  /** En-têtes de colonnes (dimanche → samedi), abrégés. */
  protected readonly weekdays: readonly string[] = [
    $localize`:@@admin.calendar.weekday.sun:dim.`,
    $localize`:@@admin.calendar.weekday.mon:lun.`,
    $localize`:@@admin.calendar.weekday.tue:mar.`,
    $localize`:@@admin.calendar.weekday.wed:mer.`,
    $localize`:@@admin.calendar.weekday.thu:jeu.`,
    $localize`:@@admin.calendar.weekday.fri:ven.`,
    $localize`:@@admin.calendar.weekday.sat:sam.`,
  ];

  /** Cellules de la grille selon vue + ancre + réservations chargées. */
  protected readonly cells = computed<readonly CalendarCell[]>(() =>
    buildGrid(this.view(), this.anchorDate(), this.bookings()),
  );

  /** Clé ISO de la cellule active (pour roving tabindex et focus). */
  protected readonly focusedKey = computed(() => isoDate(this.focusedDate()));

  /**
   * Titre du dialogue (date formatée du jour ouvert). TOUJOURS non vide dès l'ouverture, même
   * avant l'arrivée du détail async → garantit un nom accessible non vide (L-040).
   */
  protected readonly dialogTitle = computed(() => {
    const day = this.openDay();
    return day
      ? day.date.toLocaleDateString('fr-CA', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : '';
  });

  // ── Références DOM ─────────────────────────────────────────────────────────
  private readonly gridCells = viewChildren<ElementRef<HTMLElement>>('gridCell');
  private readonly viewRadios = viewChildren<ElementRef<HTMLButtonElement>>('viewRadio');
  private readonly dayDialog = viewChild<ElementRef<HTMLElement>>('dayDialog');
  /** Options du radiogroup « mode client » (Nouveau contact / Client existant) — roving focus. */
  private readonly modeRadios = viewChildren<ElementRef<HTMLButtonElement>>('modeRadio');
  /** Options du radiogroup « créneau libre » — roving focus. */
  private readonly slotRadios = viewChildren<ElementRef<HTMLButtonElement>>('slotRadio');
  /**
   * Cible de focus du sous-formulaire d'ajout (focus après ouverture — L-006). C'est le titre du
   * sous-formulaire (`tabindex="-1"`), TOUJOURS rendu quel que soit l'état des créneaux — contrairement
   * au bouton radio de créneau, qui n'existe que dans la branche `@else` (≥ 1 créneau libre). Un jour
   * complet/sans créneau est fréquent pour une entreprise d'installation : sans cible stable, le focus
   * tomberait sur `<body>` (WCAG 2.4.3, famille L-006).
   */
  private readonly addFormHeading = viewChild<ElementRef<HTMLElement>>('addFormHeading');

  /** Cellule (bouton) ayant ouvert le dialogue — pour lui rendre le focus à la fermeture. */
  private dayTriggerEl: HTMLElement | null = null;

  constructor() {
    // Focus dans le dialogue APRÈS son rendu (L-006 : l'effet relit dayDialog() pour se
    // ré-exécuter une fois l'élément monté par le @if).
    effect(() => {
      const dialog = this.dayDialog();
      if (this.openDay() && dialog) {
        dialog.nativeElement.focus();
      }
    });

    // Focus le titre du sous-formulaire d'ajout APRÈS son rendu (L-006 : l'effet relit
    // addFormHeading() pour se ré-exécuter une fois l'élément monté par le @if). Cible STABLE
    // (rendue dans tous les états de créneaux), donc le focus atterrit toujours dans le formulaire,
    // même un jour sans créneau libre (WCAG 2.4.3).
    effect(() => {
      const heading = this.addFormHeading();
      if (this.showAddForm() && heading) {
        heading.nativeElement.focus();
      }
    });

    // Recherche client débouncée (mode existant) : 250 ms, dé-doublonnée, annulation par switchMap,
    // résiliente (catchError → liste vide). Terme < 2 caractères → on vide les résultats sans appel.
    // Pilotée par un Subject poussé depuis l'`(input)` du champ (même idiome que l'autocomplete
    // d'adresse) — fiable au test (userEvent dispatche l'input natif → le handler pousse le terme).
    this.customerSearch$
      .pipe(
        debounceTime(250),
        map((term) => term.trim()),
        distinctUntilChanged(),
        switchMap((term) => {
          // Une frappe invalide la sélection précédente (on cherche à nouveau).
          this.selectedCustomer.set(null);
          if (term.length < 2) {
            this.searchingCustomers.set(false);
            this.customerResults.set([]);
            return of<CustomerSearchResult[]>([]);
          }
          this.searchingCustomers.set(true);
          return this.planning.searchCustomers(term).pipe(catchError(() => of([])));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((results) => {
        this.searchingCustomers.set(false);
        this.customerResults.set(results);
        this.announceAdd(
          $localize`:@@admin.calendar.add.searchCount:${results.length}:count: client(s) trouvé(s).`,
        );
      });

    this.load();
  }

  // ── Chargement de la grille ────────────────────────────────────────────────
  private load(): void {
    const { from, to } = viewRange(this.view(), this.anchorDate());
    this.loading.set(true);
    this.error.set(false);
    this.calendar.getCalendar(isoDate(from), isoDate(to)).subscribe({
      next: (rows) => {
        this.bookings.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
        this.toast.show(
          $localize`:@@admin.calendar.toast.loadError:Échec du chargement du calendrier.`,
          'error',
        );
      },
    });
  }

  // ── Navigation de période ──────────────────────────────────────────────────
  protected previousPeriod(): void {
    this.anchorDate.set(shiftPeriod(this.view(), this.anchorDate(), -1));
    this.syncFocusToAnchor();
    this.load();
    this.announcePeriod();
  }

  protected nextPeriod(): void {
    this.anchorDate.set(shiftPeriod(this.view(), this.anchorDate(), 1));
    this.syncFocusToAnchor();
    this.load();
    this.announcePeriod();
  }

  protected goToday(): void {
    const today = startOfDay(new Date());
    this.anchorDate.set(today);
    this.focusedDate.set(today);
    this.load();
    this.announcePeriod();
  }

  /** Recale la cellule active dans la nouvelle période (1er du mois / début de semaine / jour). */
  private syncFocusToAnchor(): void {
    this.focusedDate.set(this.anchorDate());
  }

  // ── Bascule de vue (radiogroup APG) ────────────────────────────────────────
  protected setView(view: CalendarView): void {
    if (view === this.view()) return;
    this.view.set(view);
    this.closeDay();
    this.load();
    this.announcePeriod();
  }

  protected onViewKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (!isRadioNavKey(event.key)) return;
    event.preventDefault();
    const current = this.views.findIndex((v) => v.view === this.view());
    const next = nextRadioIndex(event.key, current, this.views.length);
    this.setView(this.views[next].view);
    // Les 3 boutons restent montés (mêmes conditions) → focus synchrone sûr (L-015).
    this.viewRadios()[next]?.nativeElement.focus();
  }

  // ── Navigation dans la grille (grid APG) ───────────────────────────────────
  protected onGridKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    // Activation de la cellule (ouvrir le dialogue jour).
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const cell = this.cells().find((c) => c.isoDate === this.focusedKey());
      if (cell) this.openDayPanel(cell, event.target as HTMLElement);
      return;
    }

    if (!isGridNavKey(event.key)) return;
    event.preventDefault();

    const target = nextGridDate(event.key, this.focusedDate(), this.view());
    // Si la nouvelle date sort de la période affichée, on ré-ancre et on recharge.
    const targetKey = isoDate(target);
    const stillVisible = this.cells().some((c) => c.isoDate === targetKey);
    this.focusedDate.set(target);

    if (!stillVisible) {
      this.anchorDate.set(target);
      this.load();
      this.announcePeriod();
      // La grille change → focus APRÈS rendu (L-006) via setTimeout (macrotâche post-CD).
      this.focusCellAfterRender(targetKey);
      return;
    }

    // Même période → la cellule existe déjà, focus synchrone.
    this.focusCellNow(targetKey);
  }

  /** Déplace le focus sur la cellule de clé donnée, immédiatement (cellule déjà montée). */
  private focusCellNow(key: string): void {
    const el = this.gridCells().find((c) => c.nativeElement.dataset['key'] === key);
    el?.nativeElement.focus();
  }

  /** Déplace le focus sur la cellule après le prochain rendu (grille recomposée — L-006). */
  private focusCellAfterRender(key: string): void {
    // setTimeout = macrotâche post-CD : la nouvelle grille est rendue avant le focus.
    setTimeout(() => this.focusCellNow(key));
  }

  // ── Dialogue « détail du jour » ────────────────────────────────────────────
  protected openDayPanel(cell: CalendarCell, trigger: EventTarget | null): void {
    this.dayTriggerEl = trigger instanceof HTMLElement ? trigger : null;
    this.focusedDate.set(cell.date);
    this.openDay.set(cell);
    this.loadDayDetail(cell);
  }

  /** Charge le détail du jour (RDV + employés + heures) et reconstruit les formulaires. */
  private loadDayDetail(cell: CalendarCell): void {
    this.dayDetail.set(null);
    this.hoursForms.set([]);
    this.detailError.set(false);
    this.loadingDetail.set(true);
    this.saveAnnouncement.set('');
    // Le résultat d'optimisation appartient au jour précédent → on le réinitialise.
    this.optimizeResult.set(null);
    this.optimizeAnnouncement.set('');

    this.planning.getDayDetail(cell.isoDate).subscribe({
      next: (detail) => {
        this.dayDetail.set(detail);
        this.hoursForms.set(detail.staff.map((s) => this.buildHoursForm(s)));
        this.loadingDetail.set(false);
      },
      error: () => {
        this.loadingDetail.set(false);
        this.detailError.set(true);
        this.toast.show(
          $localize`:@@admin.calendar.toast.detailError:Échec du chargement du détail du jour.`,
          'error',
        );
      },
    });
  }

  /** Construit le formulaire d'heures d'un employé pré-rempli depuis ses heures actuelles. */
  private buildHoursForm(staff: StaffWorkHoursDto): WorkHoursForm {
    return new FormGroup({
      start: new FormControl(minutesToHhmm(staff.startMinutes), { nonNullable: true }),
      end: new FormControl(minutesToHhmm(staff.endMinutes), { nonNullable: true }),
      note: new FormControl(staff.note ?? '', { nonNullable: true }),
    });
  }

  protected closeDay(): void {
    if (!this.openDay()) return;
    this.openDay.set(null);
    this.dayDetail.set(null);
    this.hoursForms.set([]);
    this.optimizeResult.set(null);
    this.optimizeAnnouncement.set('');
    this.resetAddForm();
    // Retour du focus à la cellule déclencheuse (WCAG 2.4.3).
    const trigger = this.dayTriggerEl;
    this.dayTriggerEl = null;
    if (trigger) {
      setTimeout(() => trigger.focus());
    }
  }

  protected onEscape(): void {
    this.closeDay();
  }

  // ── Sauvegarde des heures (Admin) ──────────────────────────────────────────
  protected saveHours(staff: StaffWorkHoursDto, index: number): void {
    const day = this.openDay();
    const form = this.hoursForms()[index];
    if (!day || !form) return;

    const startMinutes = hhmmToMinutes(form.controls.start.value);
    const endMinutes = hhmmToMinutes(form.controls.end.value);

    // Garde côté client : fin strictement après début quand les deux sont précisées (le serveur
    // re-valide — la garde évite un aller-retour et un 422 silencieux).
    if (startMinutes !== null && endMinutes !== null && endMinutes <= startMinutes) {
      this.announceSave(
        $localize`:@@admin.calendar.hours.invalid:L'heure de fin doit être postérieure à l'heure de début.`,
      );
      return;
    }

    this.savingEmployeeId.set(staff.employeeId);
    this.announceSave($localize`:@@admin.calendar.hours.saving:Enregistrement des heures…`);

    this.planning
      .upsertWorkHours({
        employeeId: staff.employeeId,
        date: day.isoDate,
        startMinutes,
        endMinutes,
        note: form.controls.note.value.trim() || null,
      })
      .subscribe({
        next: () => {
          this.savingEmployeeId.set(null);
          this.announceSave(
            $localize`:@@admin.calendar.hours.saved:Heures de ${staff.fullName}:name: enregistrées.`,
          );
        },
        error: () => {
          this.savingEmployeeId.set(null);
          this.announceSave(
            $localize`:@@admin.calendar.hours.saveError:Échec de l'enregistrement des heures.`,
          );
        },
      });
  }

  // ── Ajout d'un RDV (US-11.2 p2, Admin) ─────────────────────────────────────
  /**
   * Déploie le sous-formulaire et charge les créneaux libres du jour ouvert. On envoie la valeur
   * `start` ISO UTC BRUTE du créneau choisi (jamais une Date locale reconstruite — L-044).
   */
  protected openAddForm(): void {
    const day = this.openDay();
    if (!day) return;
    this.showAddForm.set(true);
    this.loadingSlots.set(true);
    this.availableSlots.set([]);
    this.selectedSlot.set(null);

    // Créneaux libres du seul jour ouvert (from == to == clé locale du jour).
    this.booking.getAvailableSlots(day.isoDate, day.isoDate).subscribe({
      next: (slots) => {
        this.availableSlots.set(slots ?? []);
        this.loadingSlots.set(false);
      },
      error: () => {
        this.loadingSlots.set(false);
        this.announceAdd(
          $localize`:@@admin.calendar.add.slotsError:Échec du chargement des créneaux disponibles.`,
        );
      },
    });
  }

  /** Replie et réinitialise le sous-formulaire d'ajout (sans toucher au dialogue jour). */
  protected resetAddForm(): void {
    this.showAddForm.set(false);
    this.availableSlots.set([]);
    this.selectedSlot.set(null);
    this.addMode.set('new');
    this.customerResults.set([]);
    this.selectedCustomer.set(null);
    this.submittingBooking.set(false);
    this.addAnnouncement.set('');
    this.addForm.reset({ type: 'Installation', province: 'QC' });
    this.guestForm.reset();
    this.customerSearchTerm.reset('');
  }

  protected cancelAddForm(): void {
    this.resetAddForm();
  }

  /** Sélectionne un créneau libre (sa valeur `start` ISO UTC brute). */
  protected selectSlot(start: string): void {
    this.selectedSlot.set(start);
  }

  protected onSlotKeydown(event: KeyboardEvent, index: number): void {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (!isRadioNavKey(event.key)) return;
    event.preventDefault();
    const slots = this.availableSlots();
    if (slots.length === 0) return;
    const next = nextRadioIndex(event.key, index, slots.length);
    this.selectSlot(slots[next].start);
    // Les boutons de créneau restent montés tant que le formulaire est ouvert → focus synchrone (L-015).
    this.slotRadios()[next]?.nativeElement.focus();
  }

  /** Bascule le mode de saisie du client (radiogroup APG). */
  protected setAddMode(mode: AddMode): void {
    if (mode === this.addMode()) return;
    this.addMode.set(mode);
    // Repartir propre : on vide la sélection/recherche de l'autre mode.
    this.selectedCustomer.set(null);
    this.customerResults.set([]);
    this.customerSearchTerm.reset('');
    this.guestForm.reset();
  }

  protected onModeKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (!isRadioNavKey(event.key)) return;
    event.preventDefault();
    const modes: readonly AddMode[] = ['new', 'existing'];
    const current = modes.indexOf(this.addMode());
    const next = nextRadioIndex(event.key, current, modes.length);
    this.setAddMode(modes[next]);
    // Les 2 boutons de mode restent montés → focus synchrone sûr (L-015).
    this.modeRadios()[next]?.nativeElement.focus();
  }

  /** Saisie dans le champ de recherche → pousse le terme dans le flux débouncé (mode existant). */
  protected onCustomerSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.customerSearch$.next(value);
  }

  /** Sélectionne un client existant (on retient l'objet ; son id sera envoyé — L-036). */
  protected selectCustomer(customer: CustomerSearchResult): void {
    this.selectedCustomer.set(customer);
    this.announceAdd(
      $localize`:@@admin.calendar.add.customerSelected:Client sélectionné : ${customer.fullName}:name:.`,
    );
  }

  /**
   * Crée le RDV : envoie `targetCustomerId` (mode existant) OU `guestContact` (nouveau contact),
   * puis recharge le détail du jour ET la grille (cohérence des pastilles), et annonce le résultat.
   */
  protected submitBooking(): void {
    const day = this.openDay();
    if (this.submittingBooking() || !day) return;

    const slot = this.selectedSlot();
    if (!slot) {
      this.announceAdd($localize`:@@admin.calendar.add.noSlot:Veuillez choisir un créneau.`);
      return;
    }
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      this.announceAdd($localize`:@@admin.calendar.add.invalid:Veuillez corriger le formulaire.`);
      return;
    }

    const mode = this.addMode();
    const customer = this.selectedCustomer();
    if (mode === 'existing' && !customer) {
      this.announceAdd($localize`:@@admin.calendar.add.noCustomer:Veuillez choisir un client.`);
      return;
    }
    if (mode === 'new' && this.guestForm.invalid) {
      this.guestForm.markAllAsTouched();
      this.announceAdd($localize`:@@admin.calendar.add.invalid:Veuillez corriger le formulaire.`);
      return;
    }

    const v = this.addForm.getRawValue();
    const request: CreateBookingRequest = {
      slotStart: slot, // valeur ISO UTC brute du créneau (L-044)
      type: v.type,
      address: {
        civicNumber: v.civicNumber,
        street: v.street,
        apartment: v.apartment.trim() || null,
        city: v.city,
        province: v.province || 'QC',
        postalCode: normalizePostal(v.postalCode),
        country: 'Canada',
      },
      notes: v.notes.trim() || null,
      brand: v.brand?.trim() || null,
      model: v.model?.trim() || null,
      // Exclusifs : un client existant OU un nouveau contact (jamais les deux — re-validé serveur).
      targetCustomerId: mode === 'existing' ? (customer?.id ?? null) : null,
      guestContact: mode === 'new' ? toGuestContactRequest(this.guestForm) : null,
    };

    this.submittingBooking.set(true);
    this.announceAdd($localize`:@@admin.calendar.add.saving:Création du rendez-vous…`);

    this.booking.createBooking(request).subscribe({
      next: () => {
        this.submittingBooking.set(false);
        this.toast.show(
          $localize`:@@admin.calendar.add.success:Rendez-vous ajouté.`,
          'success',
        );
        this.resetAddForm();
        // Cohérence : recharge le détail du jour (liste des RDV) ET la grille (pastilles).
        this.loadDayDetail(day);
        this.load();
      },
      error: () => {
        this.submittingBooking.set(false);
        this.announceAdd(
          $localize`:@@admin.calendar.add.error:L'ajout du rendez-vous a échoué. Réessayez.`,
        );
        this.toast.show(
          $localize`:@@admin.calendar.add.error:L'ajout du rendez-vous a échoué. Réessayez.`,
          'error',
        );
      },
    });
  }

  /** Heure lisible d'un créneau libre (fuseau LOCAL, cohérent avec l'affichage des RDV — L-044). */
  protected slotLabel(slot: AvailableSlotDto): string {
    const fmt = (iso: string) =>
      new Date(iso).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
    return `${fmt(slot.start)} – ${fmt(slot.end)}`;
  }

  private announceAdd(message: string): void {
    this.addAnnouncement.set('');
    this.addAnnouncement.set(message);
  }

  // ── Optimisation de tournée (US-11.3, Admin) ───────────────────────────────
  /**
   * Lance l'optimisation de la tournée du jour ouvert : le serveur réordonne les RDV
   * (Pending/Confirmed) par plus proche voisin et réécrit leurs heures sur la grille. Au succès, on
   * recharge le détail du jour ET la grille (les heures ont changé) et on annonce le résultat.
   */
  protected optimizeRoute(): void {
    const day = this.openDay();
    if (this.optimizing() || !day) return;

    this.optimizing.set(true);
    this.optimizeResult.set(null);
    this.announceOptimize($localize`:@@admin.calendar.optimize.running:Optimisation de la tournée…`);

    this.planning.optimizeRoute(day.isoDate).subscribe({
      next: (result) => {
        this.optimizing.set(false);
        this.optimizeResult.set(result);
        this.announceOptimize(this.optimizeSummary(result));
        // Cohérence : les heures ont été réécrites → recharge le détail du jour ET la grille.
        this.loadDayDetailKeepResult(day, result);
        this.load();
      },
      error: () => {
        this.optimizing.set(false);
        this.announceOptimize(
          $localize`:@@admin.calendar.optimize.error:L'optimisation a échoué. Réessayez.`,
        );
        this.toast.show(
          $localize`:@@admin.calendar.optimize.error:L'optimisation a échoué. Réessayez.`,
          'error',
        );
      },
    });
  }

  /**
   * Recharge le détail du jour après optimisation SANS effacer le résultat affiché (loadDayDetail le
   * réinitialise volontairement quand on change de jour ; ici le jour est le même).
   */
  private loadDayDetailKeepResult(cell: CalendarCell, result: OptimizeRouteResult): void {
    this.loadDayDetail(cell);
    this.optimizeResult.set(result);
  }

  /** Résumé i18n du résultat (interpolé → $localize, pas i18n-, L-024). */
  protected optimizeSummary(result: OptimizeRouteResult): string {
    const rescheduled = result.stops.filter((s) => s.rescheduled).length;
    const km = Math.round(result.totalKm);
    return $localize`:@@admin.calendar.optimize.summary:Tournée optimisée : ${rescheduled}:count: RDV recalés, ${km}:km: km au total.`;
  }

  /** Étiquette du nombre de RDV exclus (interpolée → $localize, L-024). */
  protected excludedLabel(count: number): string {
    return $localize`:@@admin.calendar.optimize.excludedCount:${count}:count: RDV exclus (adresse non géolocalisée).`;
  }

  /** Distance lisible d'un segment de tournée (km arrondis). */
  protected legKmLabel(km: number): string {
    return $localize`:@@admin.calendar.optimize.legKm:${Math.round(km)}:km: km`;
  }

  /** Heure lisible d'un arrêt optimisé (fuseau LOCAL, cohérent avec l'affichage des RDV — L-044). */
  protected stopTimeLabel(slotStart: string): string {
    return new Date(slotStart).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
  }

  private announceOptimize(message: string): void {
    this.optimizeAnnouncement.set('');
    this.optimizeAnnouncement.set(message);
  }

  /** Étiquette accessible d'un fieldset/formulaire d'heures (interpolée → $localize, pas i18n-, L-024). */
  protected hoursGroupLabel(name: string): string {
    return $localize`:@@admin.calendar.hours.group:Heures de ${name}:name:`;
  }

  /** Étiquette accessible du bouton d'enregistrement par employé (interpolée → $localize, L-024). */
  protected saveLabel(name: string): string {
    return $localize`:@@admin.calendar.hours.saveAria:Enregistrer les heures de ${name}:name:`;
  }

  /** Représentation lisible d'une plage d'heures (lecture seule Staff). */
  protected hoursRange(staff: StaffWorkHoursDto): string {
    const start = minutesToHhmm(staff.startMinutes);
    const end = minutesToHhmm(staff.endMinutes);
    if (start && end) return `${start} – ${end}`;
    if (start) return start;
    if (end) return end;
    return $localize`:@@admin.calendar.hours.unspecified:Horaire non précisé`;
  }

  // ── Annonces scopées (L-027 : reset neutre avant ré-annonce) ───────────────
  private announcePeriod(): void {
    const message = $localize`:@@admin.calendar.announce:Période affichée : ${this.periodLabel()}:period:`;
    this.announcement.set('');
    this.announcement.set(message);
  }

  private announceSave(message: string): void {
    this.saveAnnouncement.set('');
    this.saveAnnouncement.set(message);
  }

  /** Libellé humain de la période courante (mois AAAA / semaine du… / jour). */
  protected periodLabel(): string {
    const { from } = viewRange(this.view(), this.anchorDate());
    const anchor = this.anchorDate();
    switch (this.view()) {
      case 'month':
        return anchor.toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' });
      case 'week':
        return $localize`:@@admin.calendar.weekOf:Semaine du ${from.toLocaleDateString('fr-CA')}:date:`;
      case 'day':
        return anchor.toLocaleDateString('fr-CA', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
    }
  }

  // ── Libellés ───────────────────────────────────────────────────────────────
  protected statusLabel(status: BookingStatus): string {
    switch (status) {
      case 'Pending':
        return $localize`:@@admin.calendar.status.pending:En attente`;
      case 'Confirmed':
        return $localize`:@@admin.calendar.status.confirmed:Confirmée`;
      case 'Completed':
        return $localize`:@@admin.calendar.status.completed:Complétée`;
      case 'Cancelled':
        return $localize`:@@admin.calendar.status.cancelled:Annulée`;
    }
  }

  protected typeLabel(type: BookingType): string {
    switch (type) {
      case 'Installation':
        return $localize`:@@admin.calendar.type.installation:Installation`;
      case 'Delivery':
        return $localize`:@@admin.calendar.type.delivery:Livraison`;
      case 'Removal':
        return $localize`:@@admin.calendar.type.removal:Démontage`;
    }
  }

  protected statusModifier(status: BookingStatus): string {
    return status.toLowerCase();
  }

  /** Étiquette accessible d'une cellule : date + nombre de RDV (désambiguïse au lecteur d'écran). */
  protected cellAria(cell: CalendarCell): string {
    const date = cell.date.toLocaleDateString('fr-CA', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const count = cell.bookings.length;
    if (count === 0) {
      return $localize`:@@admin.calendar.cellAriaEmpty:${date}:date:, aucun rendez-vous`;
    }
    return $localize`:@@admin.calendar.cellAriaCount:${date}:date:, ${count}:count: rendez-vous`;
  }
}
