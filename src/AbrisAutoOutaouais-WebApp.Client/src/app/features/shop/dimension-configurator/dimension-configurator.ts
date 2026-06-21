import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { Subject, catchError, debounceTime, of, switchMap } from 'rxjs';
import { ShelterService } from '../../../core/services/shelter.service';
import { ShelterModelDetail } from '../../../core/models/shelter.model';
import { isRadioNavKey, nextRadioIndex } from '../../mesurer/util/radio-nav.util';
import { formatFeetInches } from '../../mesurer/util/feet-inches.util';

/** Configuration retenue par l'utilisateur — émise pour la sous-tâche 9.4 (ajout au panier). */
export interface ShelterConfiguration {
  readonly slug: string;
  readonly modelName: string;
  readonly widthCm: number;
  readonly clearHeightCm: number;
  readonly lengthCm: number;
  readonly archCount: number;
  /** Prix total en DOLLARS (issu de l'endpoint serveur — source unique, L-004). */
  readonly totalPrice: number;
}

/**
 * Configurateur de dimensions d'un abri PARAMÉTRIQUE (EPIC 9.3, rework EPIC 9).
 *
 * - Largeur : une seule option ⇒ LIGNE STATIQUE accessible (`<p>`) ; plusieurs ⇒ `radiogroup`
 *   conforme APG (roving tabindex + flèches + Home/End, focus synchrone car options statiques —
 *   L-015 ; util pur `radio-nav.util`). `selectedWidthCm()` reste correct dans les deux cas.
 * - Hauteur dégagée : `radiogroup` APG (inchangé).
 * - Longueur : choix DISCRET via un `<select>` natif lié à `lengthControl` (reactive form). Les
 *   options sont les multiples du pas entre `min` et `max` (alignement garanti par construction).
 * - Prix : calcul OPTIMISTE local immédiat (miroir EXACT de `ShelterPriceCalculator.cs`),
 *   puis ÉCRASÉ par la réponse de `/price` (source unique — L-004), debounce 300 ms.
 * - Annonce de prix en `aria-live="polite"` avec passage par un état NEUTRE avant chaque
 *   réannonce, pour réannoncer même une valeur identique (L-027).
 *
 * Jetons sémantiques uniquement (contraste validé en e2e dual-thème — L-016).
 */
@Component({
  selector: 'app-dimension-configurator',
  templateUrl: './dimension-configurator.html',
  styleUrl: './dimension-configurator.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, CurrencyPipe],
})
export class DimensionConfiguratorComponent implements OnInit {
  private readonly fb = new FormBuilder();
  private readonly shelterService = inject(ShelterService);
  private readonly destroyRef = inject(DestroyRef);

  /** Slug du MODÈLE paramétrique (≠ slug produit) à configurer. */
  readonly slug = input.required<string>();

  /**
   * Longueur initiale souhaitée (cm), optionnelle — fournie par le deep-link depuis `/mesurer`
   * (EPIC 10). Clampée à l'option valide la plus proche ≤ dans `configureForm` ; à défaut
   * (null/invalide), on retombe sur la longueur minimale.
   */
  readonly initialLengthCm = input<number | null>(null);

  /** Émet la configuration retenue à chaque prix serveur confirmé (pour 9.4). */
  readonly configurationChange = output<ShelterConfiguration>();

  protected readonly model = signal<ShelterModelDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);

  /** Index sélectionné dans chaque radiogroup (roving tabindex APG). */
  protected readonly widthIndex = signal(0);
  protected readonly heightIndex = signal(0);

  /** Boutons radio (ordre DOM) pour déplacer le focus au clavier. */
  private readonly widthRadios = viewChildren<ElementRef<HTMLButtonElement>>('widthRadio');
  private readonly heightRadios = viewChildren<ElementRef<HTMLButtonElement>>('heightRadio');

  /** Longueur configurée (cm) — liée au `<select>` natif (choix discret). */
  protected readonly lengthControl = this.fb.control<number>(0, { nonNullable: true });

  /** Longueur courante (signal synchronisé sur le contrôle) pour le calcul optimiste. */
  protected readonly lengthCm = signal(0);

  /** Prix optimiste local immédiat (dollars), puis écrasé par la réponse serveur. */
  protected readonly optimisticPrice = signal<number | null>(null);

  /** Prix confirmé par le serveur (dollars) — source unique pour l'affichage et l'émission. */
  protected readonly serverPrice = signal<number | null>(null);

  /** Nombre d'arches confirmé par le serveur. */
  protected readonly serverArchCount = signal<number | null>(null);

  /** Vrai pendant un recalcul serveur en cours (affichage « calcul… »). */
  protected readonly pricing = signal(false);

  /** Message d'annonce du prix (aria-live) — repassé à '' avant chaque réannonce (L-027). */
  protected readonly priceAnnouncement = signal('');

  /** Largeur sélectionnée (cm), dérivée de l'index et du modèle. */
  protected readonly selectedWidthCm = computed(() => {
    const m = this.model();
    return m ? (m.widthOptionsCm[this.widthIndex()] ?? 0) : 0;
  });

  /** Hauteur dégagée sélectionnée (cm), dérivée de l'index et du modèle. */
  protected readonly selectedHeightCm = computed(() => {
    const m = this.model();
    return m ? (m.clearHeightOptionsCm[this.heightIndex()] ?? 0) : 0;
  });

  /**
   * Longueurs offertes (cm) : les multiples du pas entre `min` et `max` inclus. L'alignement est
   * garanti par construction, donc le `<select>` ne peut jamais produire de valeur désalignée.
   */
  protected readonly lengthOptionsCm = computed<readonly number[]>(() => {
    const m = this.model();
    if (!m) return [];
    const count = Math.floor((m.maxLengthCm - m.minLengthCm) / m.lengthStepCm) + 1;
    return Array.from({ length: count }, (_, i) => m.minLengthCm + i * m.lengthStepCm);
  });

  /** Prix affiché : le serveur prime ; à défaut l'optimiste (jamais les deux mélangés). */
  protected readonly displayedPrice = computed(() => this.serverPrice() ?? this.optimisticPrice());

  /** Déclencheur des appels `/price` (debounce + switchMap pour annuler les requêtes obsolètes). */
  private readonly priceRequest = new Subject<number>();

  protected formatFeetInches = formatFeetInches;

  ngOnInit(): void {
    // Synchronise le signal de longueur sur le contrôle (range/number liés au même contrôle).
    this.lengthControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => this.onLengthChange(Number(value)));

    // Pipeline de prix serveur : debounce 300 ms, annule la requête précédente (switchMap),
    // tolère l'erreur (422 hors plage) sans casser le flux.
    this.priceRequest
      .pipe(
        debounceTime(300),
        switchMap(lengthCm =>
          this.shelterService.getPrice(this.slug(), lengthCm).pipe(
            catchError(() => of(null)),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(price => {
        this.pricing.set(false);
        if (price) {
          this.serverPrice.set(price.totalPrice);
          this.serverArchCount.set(price.archCount);
          this.announcePrice(price.totalPrice);
          this.emitConfiguration(price.totalPrice, price.archCount);
        }
      });

    this.shelterService.getModel(this.slug()).subscribe({
      next: model => {
        this.model.set(model);
        this.configureForm(model);
        this.loading.set(false);
      },
      error: () => {
        this.notFound.set(true);
        this.loading.set(false);
      },
    });
  }

  /** Initialise le contrôle de longueur (1re option offerte) et lance le 1er calcul de prix. */
  private configureForm(model: ShelterModelDetail): void {
    // Les options du `<select>` sont les multiples du pas dans [min, max] : la valeur est donc
    // toujours alignée par construction. On garde min/max en garde-fous, l'alignement n'a plus
    // besoin d'être validé côté formulaire.
    this.lengthControl.setValidators([
      Validators.required,
      Validators.min(model.minLengthCm),
      Validators.max(model.maxLengthCm),
    ]);
    // Longueur initiale : si un deep-link a fourni `initialLengthCm`, on la CLAMPE à l'option valide
    // la plus grande ≤ (multiple du pas dans [min, max]) ; sinon on retombe sur la longueur minimale.
    const initialLength = this.clampInitialLength(model);
    this.lengthControl.setValue(initialLength, { emitEvent: false });
    this.lengthCm.set(initialLength);
    this.recomputeOptimistic();
    this.requestServerPrice();
  }

  /**
   * Clampe `initialLengthCm()` sur les longueurs offertes (`lengthOptionsCm`) : on retient la plus
   * grande option ≤ la valeur demandée. Repli sur `minLengthCm` si la valeur est null, ≤ min, ou
   * absente. Garantit une valeur toujours alignée sur le pas (donc valide pour `/price`).
   */
  private clampInitialLength(model: ShelterModelDetail): number {
    const requested = this.initialLengthCm();
    if (requested === null || requested <= model.minLengthCm) {
      return model.minLengthCm;
    }
    const options = this.lengthOptionsCm();
    let best = model.minLengthCm;
    for (const option of options) {
      if (option <= requested) {
        best = option;
      }
    }
    return best;
  }

  protected onLengthChange(value: number): void {
    this.lengthCm.set(value);
    this.recomputeOptimistic();
    this.requestServerPrice();
  }

  /** Calcul OPTIMISTE local — miroir EXACT de `ShelterPriceCalculator.cs` (L-004). */
  private recomputeOptimistic(): void {
    const m = this.model();
    if (!m) return;
    const length = this.lengthCm();
    const offset = length - m.minLengthCm;
    // Hors plage ou désaligné : pas d'estimation optimiste (le serveur tranchera / 422).
    if (length < m.minLengthCm || length > m.maxLengthCm || offset % m.lengthStepCm !== 0) {
      this.optimisticPrice.set(null);
      return;
    }
    const archCount = offset / m.lengthStepCm;
    this.optimisticPrice.set(m.basePrice + archCount * (m.pricePerArchCents / 100));
  }

  /** Programme un recalcul serveur (debounce). Réinitialise le prix serveur le temps du calcul. */
  private requestServerPrice(): void {
    const m = this.model();
    if (!m) return;
    this.serverPrice.set(null);
    this.serverArchCount.set(null);
    this.pricing.set(true);
    this.priceRequest.next(this.lengthCm());
  }

  /** Réannonce le prix en repassant par un état neutre (sinon valeur identique non relue — L-027). */
  private announcePrice(totalPrice: number): void {
    const formatted = totalPrice.toLocaleString('fr-CA', {
      style: 'currency',
      currency: 'CAD',
    });
    this.priceAnnouncement.set('');
    this.priceAnnouncement.set(
      $localize`:@@shop.configurator.priceAnnounce:Prix mis à jour : ${formatted}:price:.`,
    );
  }

  private emitConfiguration(totalPrice: number, archCount: number): void {
    const m = this.model();
    if (!m) return;
    this.configurationChange.emit({
      slug: m.slug,
      modelName: m.name,
      widthCm: this.selectedWidthCm(),
      clearHeightCm: this.selectedHeightCm(),
      lengthCm: this.lengthCm(),
      archCount,
      totalPrice,
    });
  }

  // ── Radiogroups APG : largeur ───────────────────────────────────────────────
  protected selectWidth(index: number): void {
    this.widthIndex.set(index);
    this.reemitOnDimensionChange();
  }

  protected onWidthKeydown(event: KeyboardEvent): void {
    this.onRadioKeydown(event, this.widthIndex, this.model()?.widthOptionsCm.length ?? 0, i => {
      this.selectWidth(i);
      this.widthRadios()[i]?.nativeElement.focus();
    });
  }

  // ── Radiogroups APG : hauteur dégagée ────────────────────────────────────────
  protected selectHeight(index: number): void {
    this.heightIndex.set(index);
    this.reemitOnDimensionChange();
  }

  protected onHeightKeydown(event: KeyboardEvent): void {
    this.onRadioKeydown(event, this.heightIndex, this.model()?.clearHeightOptionsCm.length ?? 0, i => {
      this.selectHeight(i);
      this.heightRadios()[i]?.nativeElement.focus();
    });
  }

  /** Logique APG commune : flèches/Home/End déplacent ET sélectionnent (focus synchrone). */
  private onRadioKeydown(
    event: KeyboardEvent,
    indexSignal: { (): number; set(v: number): void },
    count: number,
    apply: (index: number) => void,
  ): void {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (!isRadioNavKey(event.key)) return;
    event.preventDefault();
    const next = nextRadioIndex(event.key, indexSignal(), count);
    apply(next);
  }

  /** Largeur/hauteur n'affectent pas le prix serveur, mais la config émise change → réémet. */
  private reemitOnDimensionChange(): void {
    const price = this.serverPrice();
    const arches = this.serverArchCount();
    if (price !== null && arches !== null) {
      this.emitConfiguration(price, arches);
    }
  }
}
