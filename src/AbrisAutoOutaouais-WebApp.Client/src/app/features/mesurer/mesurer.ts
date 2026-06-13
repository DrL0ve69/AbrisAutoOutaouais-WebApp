import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  signal,
  viewChild,
} from '@angular/core';
import { AddressStepComponent, MesurerAddress } from './steps/address-step/address-step';
import { MeasureStepComponent } from './steps/measure-step/measure-step';
import { ResultsStepComponent } from './steps/results-step/results-step';
import { Footprint } from './util/footprint.util';

type Step = 1 | 2 | 3;

/**
 * « Mesurer mon stationnement » (Epic D, D3) — assistant en 3 étapes :
 *  1. Adresse → 2. Mesure (calculateur clavier par défaut, ou carte) → 3. Résultats (abris D2).
 *
 * Accessibilité (CLAUDE.md + leçons) :
 *  - Focus inter-étapes (L-006) : à chaque changement d'étape, on déplace le focus sur le titre
 *    d'étape (`<h2 tabindex="-1">`) APRÈS le rendu (`setTimeout`, macrotâche post-détection),
 *    jamais dans le même tick que le `set` (sinon le focus retombe sur `<body>`).
 *  - Annonce d'étape via un `role="status" aria-live="polite"` SCOPÉ (« Étape 2 sur 3 : … ») —
 *    les tests l'ancrent par TEXTE (L-010 : `app.html` porte déjà un status global).
 *  - Indicateur d'étapes accessible (liste ordonnée, état courant marqué `aria-current`).
 */
@Component({
  selector: 'app-mesurer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AddressStepComponent, MeasureStepComponent, ResultsStepComponent],
  templateUrl: './mesurer.html',
  styleUrl: './mesurer.scss',
})
export class MesurerComponent {
  protected readonly step = signal<Step>(1);

  /** Adresse confirmée à l'étape 1 (porte lat/lng pour centrer la carte). */
  protected readonly address = signal<MesurerAddress | null>(null);
  /** Gabarit confirmé à l'étape 2 (borné `[1, 2000]`). */
  protected readonly footprint = signal<Footprint | null>(null);

  /** Titres des étapes (réutilisés par l'indicateur et l'annonce live). */
  protected readonly stepTitles: Readonly<Record<Step, string>> = {
    1: $localize`:@@mesurer.step.address:Adresse`,
    2: $localize`:@@mesurer.step.measure:Mesure`,
    3: $localize`:@@mesurer.step.results:Résultats`,
  };

  /** Liste typée des étapes pour l'indicateur (`@for`). */
  protected readonly allSteps: readonly Step[] = [1, 2, 3];

  protected readonly currentTitle = computed(() => this.stepTitles[this.step()]);

  /** Message annoncé (aria-live) à chaque changement d'étape. */
  protected readonly stepAnnouncement = computed(
    () =>
      $localize`:@@mesurer.step.announce:Étape ${this.step()}:step: sur 3 : ${this.currentTitle()}:title:`,
  );

  private readonly stepHeading = viewChild<ElementRef<HTMLHeadingElement>>('stepHeading');
  /** Évite de voler le focus au tout premier rendu (l'utilisateur arrive sur la page). */
  private firstRenderDone = false;

  constructor() {
    // Déplace le focus sur le titre d'étape APRÈS le rendu (L-006) — sauf au tout 1er affichage.
    // `setTimeout` = macrotâche post-détection : le `<h2>` de la nouvelle étape existe alors
    // dans le DOM (on ne focalise jamais dans le même tick que le `set`, sinon retour à <body>).
    effect(() => {
      this.step(); // dépendance : se ré-exécute à chaque changement d'étape
      if (!this.firstRenderDone) {
        this.firstRenderDone = true;
        return;
      }
      setTimeout(() => this.stepHeading()?.nativeElement.focus());
    });
  }

  protected onAddressSelected(address: MesurerAddress): void {
    this.address.set(address);
    this.step.set(2);
  }

  protected onFootprintComputed(footprint: Footprint): void {
    this.footprint.set(footprint);
    this.step.set(3);
  }

  protected goToStep(step: Step): void {
    // Navigation arrière uniquement (on ne saute pas une étape non franchie).
    if (step < this.step()) this.step.set(step);
  }
}
