import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  signal,
  viewChild,
} from '@angular/core';
import { DimensionStepComponent } from './steps/dimension-step/dimension-step';
import { ConseilStepComponent } from './steps/conseil-step/conseil-step';
import { Footprint } from './util/footprint.util';

type Step = 1 | 2;

/**
 * « Trouver mon abri » (EPIC 13, refonte de `/mesurer`) — assistant en 2 étapes :
 *  1. Dimensionner (3 voies : je connais mes dimensions / par véhicules / mesurer sur la carte)
 *  2. Conseil (abris compatibles).
 *
 * (13.1) Le stepper a été INVERSÉ/simplifié : l'ancienne étape « Adresse » préalable a été
 * retirée du shell — l'adresse vit DANS la voie carte de l'étape Dimensionner (13.2).
 * (13.3) L'étape finale est rendue par `app-conseil-step` (ex-`results-step`, renommé sans
 * changement de logique) ; la suite e2e couvre les 3 voies du flux Dimensionner → Conseil.
 *
 * Accessibilité (CLAUDE.md + leçons) :
 *  - Focus inter-étapes (L-006) : à chaque changement d'étape, on déplace le focus sur le titre
 *    d'étape (`<h2 tabindex="-1">`) APRÈS le rendu (`setTimeout`, macrotâche post-détection),
 *    jamais dans le même tick que le `set` (sinon le focus retombe sur `<body>`).
 *  - Annonce d'étape via un `role="status" aria-live="polite"` SCOPÉ (« Étape 2 sur 2 : … ») —
 *    les tests l'ancrent par TEXTE (L-010 : `app.html` porte déjà un status global). La
 *    réannonce reste fiable car le texte change à chaque étape (numéro + titre, L-027).
 *  - Indicateur d'étapes accessible (liste ordonnée, état courant marqué `aria-current`).
 */
@Component({
  selector: 'app-mesurer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DimensionStepComponent, ConseilStepComponent],
  templateUrl: './mesurer.html',
  styleUrl: './mesurer.scss',
})
export class MesurerComponent {
  protected readonly step = signal<Step>(1);

  /** Gabarit confirmé à l'étape 1 « Dimensionner » (borné `[1, 2000]`). */
  protected readonly footprint = signal<Footprint | null>(null);

  /** Titres des étapes (réutilisés par l'indicateur et l'annonce live). */
  protected readonly stepTitles: Readonly<Record<Step, string>> = {
    1: $localize`:@@mesurer.step.dimension:Dimensionner`,
    2: $localize`:@@mesurer.step.conseil:Conseil`,
  };

  /** Liste typée des étapes pour l'indicateur (`@for`). */
  protected readonly allSteps: readonly Step[] = [1, 2];

  protected readonly currentTitle = computed(() => this.stepTitles[this.step()]);

  /** Message annoncé (aria-live) à chaque changement d'étape. */
  protected readonly stepAnnouncement = computed(
    () =>
      $localize`:@@mesurer.step.announce:Étape ${this.step()}:step: sur 2 : ${this.currentTitle()}:title:`,
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

  protected onFootprintComputed(footprint: Footprint): void {
    this.footprint.set(footprint);
    this.step.set(2);
  }

  protected goToStep(step: Step): void {
    // Navigation arrière uniquement (on ne saute pas une étape non franchie).
    if (step < this.step()) this.step.set(step);
  }
}
