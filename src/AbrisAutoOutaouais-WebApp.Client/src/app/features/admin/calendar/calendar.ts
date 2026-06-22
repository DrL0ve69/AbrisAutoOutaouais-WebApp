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
import { RouterLink } from '@angular/router';
import { CalendarService } from '../../../core/services/calendar.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  CalendarBookingDto,
  CalendarCell,
  CalendarView,
} from '../../../core/models/calendar.model';
import { BookingStatus, BookingType } from '../../../core/models/booking.model';
import { isRadioNavKey, nextRadioIndex } from '../../mesurer/util/radio-nav.util';
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

/**
 * Vue planning (US-11.1) — calendrier EN LECTURE SEULE des créneaux (BookingSlot) existants.
 * Agrège les RDV par jour ; aucune saisie, aucun ajout/édition de RDV, aucune assignation.
 * Accessible au clavier (WCAG 2.2 AA) :
 *  - grille `role="grid"` avec roving tabindex (un seul stop de groupe) + flèches/Home/End/
 *    PageUp/PageDown qui déplacent focus ET cellule active ensemble (pattern grid APG, L-015) ;
 *  - bascule mois/semaine/jour en `role="radiogroup"` roving (réutilise radio-nav.util) ;
 *  - panneau « RDV du jour » en lecture seule, focalisé à l'ouverture, Échap/fermer rendent
 *    le focus à la cellule déclencheuse (WCAG 2.4.3) — focus déplacé APRÈS rendu (L-006) ;
 *  - live-region SCOPÉE au composant (pas de role="status" global — L-010), reset neutre avant
 *    ré-annonce d'une même valeur (L-027).
 * Admin ET Staff voient TOUT le calendrier (décision propriétaire ; pas de filtre utilisateur).
 */
@Component({
  selector: 'app-admin-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe],
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss',
  host: {
    // Échap ferme le panneau jour ouvert (et rend le focus à la cellule).
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class AdminCalendarComponent {
  private readonly calendar = inject(CalendarService);
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
  /** Jour dont le panneau « RDV du jour » est ouvert (null = fermé). */
  protected readonly openDay = signal<CalendarCell | null>(null);
  /** Annonce scopée (changement de période/vue) — vidée puis remplie pour re-déclencher la lecture. */
  protected readonly announcement = signal('');

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

  // ── Références DOM ─────────────────────────────────────────────────────────
  private readonly gridCells = viewChildren<ElementRef<HTMLElement>>('gridCell');
  private readonly viewRadios = viewChildren<ElementRef<HTMLButtonElement>>('viewRadio');
  private readonly dayPanel = viewChild<ElementRef<HTMLElement>>('dayPanel');

  /** Cellule (bouton) ayant ouvert le panneau jour — pour lui rendre le focus à la fermeture. */
  private dayTriggerEl: HTMLElement | null = null;

  constructor() {
    // Focus dans le panneau « RDV du jour » APRÈS son rendu (L-006 : l'effet relit dayPanel()
    // pour se ré-exécuter une fois l'élément monté par le @if).
    effect(() => {
      const panel = this.dayPanel();
      if (this.openDay() && panel) {
        panel.nativeElement.focus();
      }
    });
    this.load();
  }

  // ── Chargement ─────────────────────────────────────────────────────────────
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

    // Activation de la cellule (ouvrir le panneau jour).
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

  // ── Panneau « RDV du jour » (lecture seule) ────────────────────────────────
  protected openDayPanel(cell: CalendarCell, trigger: EventTarget | null): void {
    this.dayTriggerEl = trigger instanceof HTMLElement ? trigger : null;
    this.focusedDate.set(cell.date);
    this.openDay.set(cell);
  }

  protected closeDay(): void {
    if (!this.openDay()) return;
    this.openDay.set(null);
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

  // ── Annonce scopée (L-027 : reset neutre avant ré-annonce) ─────────────────
  private announcePeriod(): void {
    const message = $localize`:@@admin.calendar.announce:Période affichée : ${this.periodLabel()}:period:`;
    this.announcement.set('');
    this.announcement.set(message);
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
