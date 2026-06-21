import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import {
  DimensionConfiguratorComponent,
  ShelterConfiguration,
} from '../dimension-configurator/dimension-configurator';
import { CartService } from '../../../core/services/cart.service';
import { formatFeetInches } from '../../mesurer/util/feet-inches.util';

/**
 * Dialogue modal de configuration d'un abri PARAMÉTRIQUE (rework EPIC 9). Ouvert par le bouton
 * « Ajouter au panier » d'une carte de modèle (catalogue) ; héberge `<app-dimension-configurator>`
 * et l'ajout au panier (`cart.addShelter`).
 *
 * Contrat APG « dialog » (WCAG 2.4.3 / 2.1.2) :
 *  - `role="dialog"` + `aria-modal="true"`, libellé par le NOM du modèle (`aria-labelledby`).
 *  - Focus initial déplacé DANS le dialogue APRÈS rendu (`afterNextRender` — L-006, jamais dans le
 *    même tick que l'ajout au DOM).
 *  - Piège de focus (Tab/Shift+Tab cyclent à l'intérieur).
 *  - Fermeture par Échap, bouton « Fermer », ou clic sur le fond — émet `close`. Le PARENT (qui
 *    détient le bouton déclencheur) rend le focus : ce composant ne connaît pas le déclencheur.
 *
 * L'ajout au panier reste FOCUSABLE mais `aria-disabled` tant qu'aucun prix serveur n'est confirmé
 * (`configuration() === null` ⇔ pas de prix — L-024). Une fois l'abri ajouté, il émet `added` (avec
 * le nom du modèle) : le PARENT ferme l'overlay, affiche un toast de confirmation au niveau page et
 * rend le focus au déclencheur — ce composant ne pose plus d'annonce aria-live interne. Mouvement
 * d'ouverture/fermeture neutralisé sous `prefers-reduced-motion: reduce` (CSS `@media`, filet
 * SSR/JS-coupé).
 */
@Component({
  selector: 'app-shelter-configurator-overlay',
  templateUrl: './shelter-configurator-overlay.html',
  styleUrl: './shelter-configurator-overlay.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DimensionConfiguratorComponent],
})
export class ShelterConfiguratorOverlayComponent implements AfterViewChecked {
  private readonly cart = inject(CartService);

  /** Slug du MODÈLE paramétrique à configurer. */
  readonly slug = input.required<string>();

  /** Nom du modèle — sert de titre accessible du dialogue (`aria-labelledby`). */
  readonly modelName = input.required<string>();

  /** Longueur initiale (cm), forwardée au configurateur — deep-link depuis `/mesurer` (EPIC 10). */
  readonly initialLengthCm = input<number | null>(null);

  /** Demande de fermeture (Échap / bouton « Fermer » / clic sur le fond). */
  readonly close = output<void>();

  /** Abri ajouté au panier — porte le NOM du modèle (le parent ferme + affiche le toast). */
  readonly added = output<string>();

  /** Élément racine du dialogue (piège + focus initial). */
  private readonly dialogEl = viewChild.required<ElementRef<HTMLDivElement>>('dialogEl');

  /** Dernière configuration retenue (prix serveur confirmé) — null tant qu'aucun prix confirmé. */
  protected readonly configuration = signal<ShelterConfiguration | null>(null);

  /** Vrai dès qu'une config (donc un prix serveur) est confirmée → bouton réellement actif. */
  protected readonly canAdd = computed(() => this.configuration() !== null);

  /**
   * Titre accessible du dialogue (`aria-labelledby`). Le `modelName` peut arriver VIDE via un
   * deep-link dont le slug n'est pas encore résolu dans les modèles chargés du catalogue : un
   * `<h2>` vide laisserait le dialogue SANS nom accessible (WCAG 4.1.2). On garantit donc un nom :
   *  1) `modelName()` s'il est fourni ;
   *  2) sinon le nom du modèle remonté par la config une fois le configurateur chargé ;
   *  3) sinon un libellé générique non vide (jamais de titre vide à l'ouverture).
   */
  protected readonly displayTitle = computed(
    () =>
      this.modelName().trim() ||
      this.configuration()?.modelName ||
      $localize`:@@shop.overlay.titleFallback:Configuration de l'abri`,
  );

  protected formatFeetInches = formatFeetInches;

  /** Doit-on (re)poser le focus initial dans le dialogue au prochain cycle de vue. */
  private pendingInitialFocus = true;

  constructor() {
    // Focus initial APRÈS le premier rendu (le dialogue est dans le DOM) — L-006 :
    // ne jamais focaliser dans le même tick que l'ajout de l'élément.
    // (Échap est géré par `(keydown.escape)` sur le conteneur `.overlay` : le focus étant piégé
    //  dans le dialogue — descendant de `.overlay` —, l'événement remonte jusqu'au conteneur.)
    afterNextRender(() => this.focusInitial());
  }

  ngAfterViewChecked(): void {
    // Filet : si le viewChild n'était pas encore prêt au 1er `afterNextRender`, on (re)pose
    // le focus dès qu'il l'est. Une seule fois (drapeau).
    if (this.pendingInitialFocus) {
      this.focusInitial();
    }
  }

  /** Place le focus sur le premier élément focusable du dialogue (sinon le dialogue lui-même). */
  private focusInitial(): void {
    const first = this.getFocusableElements()[0] ?? this.dialogEl()?.nativeElement;
    if (first) {
      first.focus();
      this.pendingInitialFocus = false;
    }
  }

  protected onConfigurationChange(config: ShelterConfiguration): void {
    this.configuration.set(config);
  }

  /**
   * Ajoute l'abri configuré au panier. No-op tant qu'aucun prix serveur n'est confirmé (L-024).
   * Émet `added` (nom du modèle) : le parent ferme l'overlay, affiche le toast et rend le focus.
   */
  protected addToCart(): void {
    const config = this.configuration();
    if (config === null) return;
    this.cart.addShelter(config);
    this.added.emit(config.modelName);
  }

  /** Demande la fermeture du dialogue (le parent rend le focus au déclencheur). */
  protected requestClose(): void {
    this.close.emit();
  }

  /** Clic dans le conteneur mais HORS du panneau (fond) → ferme. Un clic dans le dialogue est ignoré. */
  protected onOverlayClick(event: MouseEvent): void {
    const dialog = this.dialogEl()?.nativeElement;
    if (dialog && !dialog.contains(event.target as Node)) {
      this.requestClose();
    }
  }

  /** Piège de focus APG : Tab/Shift+Tab cyclent dans le dialogue. */
  protected onDialogKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const focusable = this.getFocusableElements();
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private getFocusableElements(): HTMLElement[] {
    const dialog = this.dialogEl()?.nativeElement;
    if (!dialog) return [];
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');
    return Array.from(dialog.querySelectorAll<HTMLElement>(selector)).filter(
      el => el.offsetParent !== null || el === document.activeElement,
    );
  }
}
