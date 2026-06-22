import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PayrollService } from '../../../core/services/payroll.service';
import { ToastService } from '../../../core/services/toast.service';
import { EmployeePayrollDto, PayrollSummaryDto } from '../../../core/models/payroll.model';

/** Premier jour du mois courant, au format `YYYY-MM-DD` (fuseau local). */
function firstOfMonth(today: Date): string {
  return isoDate(new Date(today.getFullYear(), today.getMonth(), 1));
}

/** Dernier jour du mois courant, au format `YYYY-MM-DD` (fuseau local). */
function lastOfMonth(today: Date): string {
  return isoDate(new Date(today.getFullYear(), today.getMonth() + 1, 0));
}

/** Date locale en clé ISO `YYYY-MM-DD` (sans décalage UTC — cohérent avec l'affichage local L-044). */
function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Suivi de PAIE INFORMATIVE (EPIC 8, US-8.1) — tableau récap accessible de la masse salariale sur une
 * fenêtre de dates : total des heures, montant brut, statut de paie par employé, édition inline du
 * taux horaire et action « Marquer payé ». Réservé aux admins (route sous /admin, authGuard +
 * adminGuard). INFORMATIF uniquement : aucune déduction/taxe/virement.
 *
 * WCAG AA : table sémantique, labels associés, erreurs role="alert", statut async via aria-live,
 * cibles ≥ 44px, badges en jetons FIXES (pas de #fff sur jeton qui bascule — L-016/L-033),
 * aria-label dynamiques via $localize + placeholder nommé (jamais i18n-aria-label — L-024),
 * gestion du focus à l'ouverture/fermeture de l'édition (L-006).
 */
@Component({
  selector: 'app-admin-payroll',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, CurrencyPipe],
  templateUrl: './payroll.html',
  styleUrl: './payroll.scss',
})
export class AdminPayrollComponent {
  private readonly fb = inject(FormBuilder);
  private readonly payroll = inject(PayrollService);
  private readonly toast = inject(ToastService);

  protected readonly summary = signal<PayrollSummaryDto | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal(false);
  /** Annonce vocale du résultat du chargement / des actions (région aria-live). */
  protected readonly statusMessage = signal('');

  /** Id de l'employé dont le taux est en cours d'édition inline (null = aucun). */
  protected readonly editingRateId = signal<string | null>(null);
  protected readonly savingRateId = signal<string | null>(null);
  protected readonly markingId = signal<string | null>(null);

  protected readonly employees = computed(() => this.summary()?.employees ?? []);

  /** Cellule de saisie du taux ré-affichée par `@if` — focus à l'ouverture (L-006). */
  private readonly rateInput = viewChild<ElementRef<HTMLInputElement>>('rateInput');

  protected readonly periodForm = this.fb.group({
    from: this.fb.nonNullable.control(firstOfMonth(new Date()), [Validators.required]),
    to: this.fb.nonNullable.control(lastOfMonth(new Date()), [Validators.required]),
  });

  protected readonly rateForm = this.fb.group({
    // null autorisé (= retirer le taux) ; sinon strictement positif et ≤ 10 000 (miroir serveur).
    hourlyRate: this.fb.control<number | null>(null, [Validators.min(0.01), Validators.max(10000)]),
  });

  protected get fromCtrl() {
    return this.periodForm.controls.from;
  }
  protected get toCtrl() {
    return this.periodForm.controls.to;
  }
  protected get rateCtrl() {
    return this.rateForm.controls.hourlyRate;
  }

  /** Vrai si la fenêtre est incohérente (début après fin) — affichée sous le champ « au ». */
  protected rangeInvalid(): boolean {
    return this.fromCtrl.value > this.toCtrl.value;
  }

  constructor() {
    this.loadSummary();
  }

  /**
   * Recharge le récap. `focusAfterId` (optionnel) : id d'un élément à focaliser une fois le tableau
   * RE-RENDU après la réponse — utilisé par les actions qui retirent leur propre bouton déclencheur
   * (« Marquer payé »), pour ne pas laisser le focus tomber sur <body> (L-006). On focalise dans le
   * callback `next` (donc après que le nouveau DOM est rendu), pas via un `setTimeout` lancé avant la
   * réponse réseau.
   */
  protected loadSummary(focusAfterId?: string): void {
    if (this.periodForm.invalid || this.rangeInvalid()) {
      this.periodForm.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.loadError.set(false);
    this.statusMessage.set('');
    const { from, to } = this.periodForm.getRawValue();
    this.payroll.getSummary(from, to).subscribe({
      next: data => {
        this.summary.set(data);
        this.loading.set(false);
        this.announce(
          $localize`:@@admin.payroll.status.loaded:Récap de paie mis à jour : ${data.employees.length}:count: employé(s).`,
        );
        if (focusAfterId) {
          // Le tableau vient d'être re-rendu (set(data) ci-dessus) ; on focalise après ce cycle.
          setTimeout(() => document.getElementById(focusAfterId)?.focus());
        }
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
        this.announce(
          $localize`:@@admin.payroll.status.loadError:Échec du chargement du récap de paie.`,
        );
      },
    });
  }

  // ── Édition du taux horaire (inline) ──────────────────────────────────────────

  protected startEditRate(emp: EmployeePayrollDto): void {
    this.rateCtrl.setValue(emp.hourlyRate);
    this.rateCtrl.markAsPristine();
    this.editingRateId.set(emp.employeeId);
    // Le champ apparaît via @if : focus APRÈS rendu (L-006).
    setTimeout(() => this.rateInput()?.nativeElement.focus());
  }

  protected cancelEditRate(employeeId: string): void {
    this.editingRateId.set(null);
    // Le bouton « Taux » réapparaît (nouveau nœud DOM) : focus PAR ID après ce cycle de rendu, et
    // non sur le nœud déclencheur capturé (désormais détaché) — L-006.
    this.focusRateTriggerById(employeeId);
  }

  protected saveRate(employeeId: string): void {
    if (this.rateForm.invalid) {
      this.rateForm.markAllAsTouched();
      return;
    }
    const raw = this.rateCtrl.value;
    // Un champ vide (null / NaN) signifie « retirer le taux ».
    const hourlyRate = raw === null || Number.isNaN(raw) ? null : raw;

    this.savingRateId.set(employeeId);
    this.payroll.setHourlyRate(employeeId, hourlyRate).subscribe({
      next: () => {
        this.savingRateId.set(null);
        this.editingRateId.set(null);
        this.toast.show(
          $localize`:@@admin.payroll.toast.rateSaved:Taux horaire enregistré.`,
          'success',
        );
        // Le formulaire inline se referme et le tableau est rechargé (DOM remplacé) : on rend le
        // focus au bouton « Taux » de la ligne PAR SON ID, une fois re-rendu (L-006).
        this.loadSummary(`rate-trigger-${employeeId}`);
      },
      error: () => {
        this.savingRateId.set(null);
        this.toast.show(
          $localize`:@@admin.payroll.toast.rateError:L'enregistrement du taux a échoué.`,
          'error',
        );
      },
    });
  }

  // ── Marquer la paie d'un employé comme payée sur la fenêtre ────────────────────

  protected markPaid(emp: EmployeePayrollDto): void {
    const { from, to } = this.periodForm.getRawValue();
    this.markingId.set(emp.employeeId);
    this.payroll.markPeriodPaid(emp.employeeId, from, to, 'Payee').subscribe({
      next: () => {
        this.markingId.set(null);
        this.toast.show(
          $localize`:@@admin.payroll.toast.marked:Paie marquée comme payée.`,
          'success',
        );
        // Le bouton « Marquer payé » disparaît au rechargement (la ligne devient « Payée ») : on
        // redonne le focus au bouton « Taux » de la même ligne — TOUJOURS présent — une fois le
        // tableau re-rendu, sinon le focus tomberait sur <body> (L-006).
        this.loadSummary(`rate-trigger-${emp.employeeId}`);
      },
      error: () => {
        this.markingId.set(null);
        this.toast.show(
          $localize`:@@admin.payroll.toast.markError:Le marquage de la paie a échoué.`,
          'error',
        );
      },
    });
  }

  // ── Présentation ──────────────────────────────────────────────────────────────

  /** Heures décimales lisibles (ex. 540 min → « 9,0 h ») pour l'affichage. */
  protected hoursLabel(totalMinutes: number): string {
    const hours = totalMinutes / 60;
    return $localize`:@@admin.payroll.table.hoursValue:${hours.toLocaleString('fr-CA', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}:hours: h`;
  }

  protected isPaid(emp: EmployeePayrollDto): boolean {
    return emp.payStatus === 'Payee';
  }

  /** Libellé accessible du bouton « Modifier le taux » d'un employé (aria-label bound → $localize, L-024). */
  protected editRateLabel(name: string): string {
    return $localize`:@@admin.payroll.table.editRateLabel:Modifier le taux horaire de ${name}:name:`;
  }

  /** Libellé accessible du bouton « Marquer payé » d'un employé (L-024). */
  protected markPaidLabel(name: string): string {
    return $localize`:@@admin.payroll.table.markPaidLabel:Marquer la paie de ${name}:name: comme payée`;
  }

  /**
   * Déplace le focus sur le bouton « Taux » d'une ligne (id `rate-trigger-{id}`, toujours présent)
   * une fois le DOM re-rendu (`@if` ou rechargement) — L-006 : focus après render, jamais sur un
   * nœud détaché ni sur <body>.
   */
  private focusRateTriggerById(employeeId: string): void {
    setTimeout(() => document.getElementById(`rate-trigger-${employeeId}`)?.focus());
  }

  /** Réinitialise la région aria-live à vide puis pose le message, pour forcer une ré-annonce (L-027). */
  private announce(message: string): void {
    this.statusMessage.set('');
    this.statusMessage.set(message);
  }
}
