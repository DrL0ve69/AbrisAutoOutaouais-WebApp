import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  signal,
  computed,
  viewChild,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../../core/services/product.service';
import { ShelterService } from '../../../core/services/shelter.service';
import { ShelterAdminService } from '../../../core/services/shelter-admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { CategoryDto } from '../../../core/models/product.model';
import { ShelterModelSummary } from '../../../core/models/shelter.model';

type FormMode = 'create' | 'edit';

/**
 * Parse une saisie texte « valeurs cm séparées par virgule » en `number[]` : on découpe sur la
 * virgule, on retire les espaces, on convertit en nombre et on écarte les valeurs non numériques
 * (NaN). Fonction PURE (testable isolément) — le formulaire l'utilise pour les listes de largeurs
 * et de hauteurs. Ne FILTRE pas les ≤ 0 : c'est le validateur (`atLeastOnePositiveInteger`) qui
 * juge la validité, pour pouvoir AFFICHER une erreur sur « 0 » ou « -5 » plutôt que de les masquer.
 */
export function parseCmList(raw: string): number[] {
  return raw
    .split(',')
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .map(part => Number(part))
    .filter(value => !Number.isNaN(value));
}

/**
 * Validateur synchrone réutilisable pour un champ « liste de cm » : exige AU MOINS une valeur,
 * et que CHAQUE valeur soit un entier strictement positif (miroir des invariants serveur :
 * `WidthsCm`/`ClearHeightsCm` non vides + chaque valeur entière > 0).
 */
export function atLeastOnePositiveInteger(control: AbstractControl): ValidationErrors | null {
  const values = parseCmList(String(control.value ?? ''));
  if (values.length === 0) {
    return { required: true };
  }
  const allValid = values.every(v => Number.isInteger(v) && v > 0);
  return allValid ? null : { positiveIntegers: true };
}

/**
 * Administration du RÉFÉRENTIEL de modèles d'abris paramétriques (EPIC 9.5) — liste, création,
 * édition et suppression. Calque `AdminProductsComponent` (OnPush, signals, reactive form, table,
 * dialogue de suppression accessible, contrat de focus L-006). Accès réservé aux admins (route
 * sous /admin, protégée par authGuard + adminGuard).
 *
 * Décisions tranchées : le SLUG est IMMUABLE à l'édition (lecture seule, non envoyé). Les listes
 * de largeurs / hauteurs se saisissent en champ texte « cm séparés par virgule » (cf. parseCmList).
 * Le PRIX PAR ARCHE se saisit directement en CENTS (libellé explicite) pour éviter tout bug
 * d'arrondi monétaire ; le PRIX DE BASE reste en dollars.
 * WCAG AA : table sémantique, labels associés, erreurs role="alert", cibles ≥ 44px, hints liés.
 */
@Component({
  selector: 'app-admin-shelter-models',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, CurrencyPipe],
  templateUrl: './shelter-models.html',
  styleUrl: './shelter-models.scss',
})
export class AdminShelterModelsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly products = inject(ProductService);
  private readonly shelters = inject(ShelterService);
  private readonly admin = inject(ShelterAdminService);
  private readonly toast = inject(ToastService);

  protected readonly items = signal<readonly ShelterModelSummary[]>([]);
  protected readonly categories = signal<readonly CategoryDto[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly mode = signal<FormMode>('create');
  protected readonly editingId = signal<string | null>(null);
  protected readonly editingSlug = signal<string>('');
  protected readonly formError = signal<string | null>(null);

  /** Id du modèle en attente de confirmation de suppression. */
  protected readonly pendingDeleteId = signal<string | null>(null);

  protected readonly isEditing = computed(() => this.mode() === 'edit');

  // Gestion du focus du dialogue de suppression (WCAG 2.4.3 / APG modal) — même contrat
  // que admin/products (delDialog / listHeading / deleteTriggerEl).
  private readonly delDialog = viewChild<ElementRef<HTMLElement>>('delDialog');
  private readonly listHeading = viewChild<ElementRef<HTMLElement>>('listHeading');
  private deleteTriggerEl: HTMLElement | null = null;

  protected readonly form = this.fb.group({
    slug: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(100),
      Validators.pattern(/^[a-z0-9-]+$/),
    ]),
    name: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(100)]),
    categoryId: this.fb.nonNullable.control('', [Validators.required]),
    lengthStepCm: this.fb.nonNullable.control(122, [Validators.required, Validators.min(1)]),
    minLengthCm: this.fb.nonNullable.control(122, [Validators.required, Validators.min(1)]),
    maxLengthCm: this.fb.nonNullable.control(1830, [Validators.required, Validators.min(1)]),
    basePrice: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    pricePerArchCents: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    widthsCm: this.fb.nonNullable.control('', [atLeastOnePositiveInteger]),
    clearHeightsCm: this.fb.nonNullable.control('', [atLeastOnePositiveInteger]),
  });

  protected get slugCtrl() { return this.form.controls.slug; }
  protected get nameCtrl() { return this.form.controls.name; }
  protected get categoryCtrl() { return this.form.controls.categoryId; }
  protected get stepCtrl() { return this.form.controls.lengthStepCm; }
  protected get minCtrl() { return this.form.controls.minLengthCm; }
  protected get maxCtrl() { return this.form.controls.maxLengthCm; }
  protected get basePriceCtrl() { return this.form.controls.basePrice; }
  protected get archCentsCtrl() { return this.form.controls.pricePerArchCents; }
  protected get widthsCtrl() { return this.form.controls.widthsCm; }
  protected get heightsCtrl() { return this.form.controls.clearHeightsCm; }

  /**
   * Vrai si min ≥ max (incohérence inter-champs) — affichée sous le champ « longueur max ».
   * MÉTHODE (et non `computed`) : elle lit la valeur de contrôles de formulaire réactif, qui ne
   * sont pas des signaux ; un `computed` n'aurait aucune dépendance et ne se recalculerait jamais.
   * Évaluée à chaque cycle de détection de changement, comme les getters `*.invalid` du template.
   */
  protected rangeInvalid(): boolean {
    const min = this.minCtrl.value;
    const max = this.maxCtrl.value;
    return Number.isFinite(min) && Number.isFinite(max) && min >= max;
  }

  constructor() {
    // À l'ouverture du dialogue, déplace le focus à l'intérieur (lit delDialog() pour se
    // ré-exécuter quand le @if l'a rendu) — sinon Échap / le piège de focus seraient inopérants.
    effect(() => {
      const dialog = this.delDialog();
      if (this.pendingDeleteId() && dialog) {
        dialog.nativeElement.focus();
      }
    });
    this.loadCategories();
    this.loadModels();
  }

  private loadCategories(): void {
    this.products.getCategories().subscribe({
      next: cats => this.categories.set(cats),
      error: () =>
        this.toast.show(
          $localize`:@@admin.shelterModels.toast.loadError:Échec du chargement.`,
          'error',
        ),
    });
  }

  protected loadModels(): void {
    this.loading.set(true);
    this.shelters.getModels().subscribe({
      next: models => {
        this.items.set(models);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.show(
          $localize`:@@admin.shelterModels.toast.loadError:Échec du chargement.`,
          'error',
        );
      },
    });
  }

  protected startCreate(): void {
    this.mode.set('create');
    this.editingId.set(null);
    this.editingSlug.set('');
    this.formError.set(null);
    this.form.reset({
      slug: '', name: '', categoryId: '',
      lengthStepCm: 122, minLengthCm: 122, maxLengthCm: 1830,
      basePrice: 0, pricePerArchCents: 0,
      widthsCm: '', clearHeightsCm: '',
    });
    this.slugCtrl.enable();
  }

  protected startEdit(model: ShelterModelSummary): void {
    this.mode.set('edit');
    this.editingId.set(model.id);
    this.editingSlug.set(model.slug);
    this.formError.set(null);

    // Le résumé ne porte ni le prix/arche ni les options de dimensions : on charge le détail.
    this.shelters.getModel(model.slug).subscribe({
      next: detail => {
        this.form.reset({
          slug: detail.slug,
          name: detail.name,
          categoryId: detail.categoryId,
          lengthStepCm: detail.lengthStepCm,
          minLengthCm: detail.minLengthCm,
          maxLengthCm: detail.maxLengthCm,
          basePrice: detail.basePrice,
          pricePerArchCents: detail.pricePerArchCents,
          widthsCm: detail.widthOptionsCm.join(', '),
          clearHeightsCm: detail.clearHeightOptionsCm.join(', '),
        });
        // Slug IMMUABLE à l'édition : on désactive le contrôle (affiché en lecture seule, non envoyé).
        this.slugCtrl.disable();
      },
      error: () =>
        this.toast.show(
          $localize`:@@admin.shelterModels.toast.loadError:Échec du chargement.`,
          'error',
        ),
    });
  }

  protected cancelEdit(): void {
    this.startCreate();
  }

  protected submit(): void {
    if (this.form.invalid || this.rangeInvalid()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    const v = this.form.getRawValue();
    const widthsCm = parseCmList(v.widthsCm);
    const clearHeightsCm = parseCmList(v.clearHeightsCm);

    if (this.isEditing()) {
      const id = this.editingId()!;
      // Slug NON envoyé en édition (immuable).
      this.admin
        .updateModel(id, {
          name: v.name,
          categoryId: v.categoryId,
          lengthStepCm: v.lengthStepCm,
          minLengthCm: v.minLengthCm,
          maxLengthCm: v.maxLengthCm,
          basePrice: v.basePrice,
          pricePerArchCents: v.pricePerArchCents,
          widthsCm,
          clearHeightsCm,
        })
        .subscribe({
          next: () =>
            this.onSaved($localize`:@@admin.shelterModels.toast.updated:Modèle mis à jour.`),
          error: err => this.onError(err),
        });
    } else {
      this.admin
        .createModel({
          slug: v.slug,
          name: v.name,
          categoryId: v.categoryId,
          lengthStepCm: v.lengthStepCm,
          minLengthCm: v.minLengthCm,
          maxLengthCm: v.maxLengthCm,
          basePrice: v.basePrice,
          pricePerArchCents: v.pricePerArchCents,
          widthsCm,
          clearHeightsCm,
        })
        .subscribe({
          next: () =>
            this.onSaved($localize`:@@admin.shelterModels.toast.created:Modèle créé.`),
          error: err => this.onError(err),
        });
    }
  }

  private onSaved(message: string): void {
    this.saving.set(false);
    this.toast.show(message, 'success');
    this.startCreate();
    this.loadModels();
  }

  private onError(err: { error?: { detail?: string } }): void {
    this.saving.set(false);
    this.formError.set(
      err.error?.detail ??
        $localize`:@@admin.shelterModels.toast.saveError:Une erreur est survenue. Veuillez réessayer.`,
    );
  }

  protected askDelete(id: string, event: MouseEvent): void {
    this.deleteTriggerEl = event.currentTarget as HTMLElement;
    this.pendingDeleteId.set(id);
  }

  protected cancelDelete(): void {
    // Refermé sans agir : la ligne (donc le bouton déclencheur) existe toujours → focus rendu.
    this.pendingDeleteId.set(null);
    this.focusDeleteTrigger();
  }

  protected confirmDelete(): void {
    const id = this.pendingDeleteId();
    if (!id) {
      return;
    }
    this.admin.deleteModel(id).subscribe({
      next: () => {
        this.pendingDeleteId.set(null);
        this.toast.show(
          $localize`:@@admin.shelterModels.toast.deleted:Modèle supprimé.`,
          'success',
        );
        if (this.editingId() === id) {
          this.startCreate();
        }
        this.loadModels();
        // Le bouton déclencheur disparaît (modèle supprimé) : focus sur le titre de la liste
        // APRÈS le rendu, sinon il tomberait sur <body> (L-006).
        this.focusListHeadingAfterRender();
      },
      error: () => {
        // Échec : le modèle (et son bouton) reste → retour au déclencheur.
        this.pendingDeleteId.set(null);
        this.toast.show(
          $localize`:@@admin.shelterModels.toast.deleteError:La suppression a échoué.`,
          'error',
        );
        this.focusDeleteTrigger();
      },
    });
  }

  /** Rend le focus au bouton « Supprimer » déclencheur (toujours présent). */
  private focusDeleteTrigger(): void {
    this.deleteTriggerEl?.focus();
    this.deleteTriggerEl = null;
  }

  /** Déplace le focus sur le titre de la liste une fois la ligne supprimée du DOM (L-006). */
  private focusListHeadingAfterRender(): void {
    this.deleteTriggerEl = null;
    setTimeout(() => this.listHeading()?.nativeElement.focus());
  }

  protected modelName(id: string | null): string {
    return this.items().find(m => m.id === id)?.name ?? '';
  }

  /**
   * Libellé accessible du bouton « Modifier » d'une ligne. Construit via `$localize` (et NON un
   * `[attr.aria-label]` codé en dur) : un aria-label est un attribut BOUND, donc `i18n-` ne s'y
   * applique pas (L-024) — sans cela le nom accessible resterait français en build EN.
   */
  protected editLabel(name: string): string {
    return $localize`:@@admin.shelterModels.table.editLabel:Modifier ${name}:name:`;
  }

  /** Libellé accessible du bouton « Supprimer » d'une ligne (même raison que `editLabel`). */
  protected deleteLabel(name: string): string {
    return $localize`:@@admin.shelterModels.table.deleteLabel:Supprimer ${name}:name:`;
  }
}
