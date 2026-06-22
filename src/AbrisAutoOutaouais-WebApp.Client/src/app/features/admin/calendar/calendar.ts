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
import { FormArray, FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CalendarService } from '../../../core/services/calendar.service';
import { PlanningService } from '../../../core/services/planning.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  CalendarBookingDto,
  CalendarCell,
  CalendarView,
} from '../../../core/models/calendar.model';
import { DayDetailDto, StaffWorkHoursDto } from '../../../core/models/planning.model';
import { BookingStatus, BookingType } from '../../../core/models/booking.model';
import { isRadioNavKey, nextRadioIndex } from '../../mesurer/util/radio-nav.util';
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
 * (formulaire réactif par employé) ; le Staff voit les heures en lecture seule. Ajouter des RDV
 * ou des employés est HORS périmètre.
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
  imports: [RouterLink, DatePipe, ReactiveFormsModule],
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
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

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
