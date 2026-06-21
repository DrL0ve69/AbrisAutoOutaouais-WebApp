import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ShelterSuggestionService } from '../../../../core/services/shelter-suggestion.service';
import { ShelterFitResult } from '../../../../core/models/shelter-fit.model';
import { Footprint } from '../../util/footprint.util';
import { cmToFeet } from '../../util/units.util';

/**
 * Étape 2 « Conseil » (EPIC 13, renommée depuis « Résultats » en 13.3 — logique INCHANGÉE) —
 * interroge `/shelters/suggest` avec le gabarit calculé et présente les MODÈLES paramétriques
 * compatibles, groupés par catégorie (EPIC 10, US-10.1). Pour chaque modèle, on affiche les
 * longueurs admissibles (en pieds) et un lien « Configurer » vers le configurateur du catalogue,
 * pré-rempli (catégorie + slug du modèle + plus grande longueur admissible).
 *
 * États chargement (aria-busy + aria-live), erreur (role="alert") et vide (role="status") gérés.
 * Le gabarit reçu est déjà borné `[1, 2000]` par `footprint.util`, donc l'appel ne part pas en 422.
 */
@Component({
  selector: 'app-conseil-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CurrencyPipe, DecimalPipe],
  templateUrl: './conseil-step.html',
  styleUrl: './conseil-step.scss',
})
export class ConseilStepComponent {
  private readonly service = inject(ShelterSuggestionService);

  /** Affichage : cm (canonique) → pieds. Le gabarit et les modèles sont stockés en cm. */
  protected readonly toFeet = cmToFeet;

  /** Gabarit requis (cm), borné `[1, 2000]`. `null` tant qu'aucune mesure n'est faite. */
  readonly footprint = input<Footprint | null>(null);

  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly results = signal<readonly ShelterFitResult[]>([]);

  constructor() {
    effect(() => {
      const fp = this.footprint();
      if (!fp || fp.outOfRange) {
        this.results.set([]);
        return;
      }
      this.fetch(fp.widthCm, fp.lengthCm);
    });
  }

  /** Plus grande longueur admissible du modèle (cm), pour pré-remplir le configurateur. */
  protected longestLengthCm(lengths: readonly number[]): number {
    return lengths.length > 0 ? lengths[lengths.length - 1] : 0;
  }

  /** Longueurs admissibles formatées en pieds (1 décimale), séparées par «, ». */
  protected availableFeet(lengthsCm: readonly number[]): string {
    return lengthsCm
      .map(cm => cmToFeet(cm).toLocaleString('fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 }))
      .join(', ');
  }

  /**
   * Libellé accessible du lien « Configurer » interpolant le nom du modèle. `$localize` (et non
   * `i18n-aria-label`) car l'attribut est BOUND (L-024) ; placeholder nommé `:name:` requis par xlf.
   */
  protected configureLabel(name: string): string {
    return $localize`:@@mesurer.results.configureLabel:Configurer le modèle ${name}:name:`;
  }

  private fetch(widthCm: number, lengthCm: number): void {
    this.loading.set(true);
    this.error.set(false);
    this.service.suggestModels(widthCm, lengthCm).subscribe({
      next: results => {
        this.results.set(results);
        this.loading.set(false);
      },
      error: () => {
        this.results.set([]);
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
