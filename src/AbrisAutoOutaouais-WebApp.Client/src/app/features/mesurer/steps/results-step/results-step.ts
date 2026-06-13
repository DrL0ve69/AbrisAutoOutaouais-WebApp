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
import { ShelterSuggestionDto } from '../../../../core/models/shelter-suggestion.model';
import { Footprint } from '../../util/footprint.util';
import { cmToFeet } from '../../util/units.util';

/**
 * Étape 3 « Résultats » — interroge D2 `suggest-shelters` avec le gabarit calculé et présente
 * les abris adaptés. Le badge « Ajusté serré » s'affiche UNIQUEMENT si `isTightFit` (calculé
 * serveur — on lit le drapeau, jamais de recalcul). États chargement (aria-busy) et vide gérés.
 *
 * Le gabarit reçu est déjà borné `[1, 2000]` par `footprint.util` (le shell ne transmet pas un
 * gabarit hors plage), donc l'appel D2 ne peut pas partir en 422.
 */
@Component({
  selector: 'app-results-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CurrencyPipe, DecimalPipe],
  templateUrl: './results-step.html',
  styleUrl: './results-step.scss',
})
export class ResultsStepComponent {
  private readonly service = inject(ShelterSuggestionService);

  /** Affichage : cm (canonique) → pieds. Le gabarit et les abris sont stockés en cm. */
  protected readonly toFeet = cmToFeet;

  /** Gabarit requis (cm), borné `[1, 2000]`. `null` tant qu'aucune mesure n'est faite. */
  readonly footprint = input<Footprint | null>(null);

  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly suggestions = signal<readonly ShelterSuggestionDto[]>([]);

  constructor() {
    effect(() => {
      const fp = this.footprint();
      if (!fp || fp.outOfRange) {
        this.suggestions.set([]);
        return;
      }
      this.fetch(fp.widthCm, fp.lengthCm);
    });
  }

  private fetch(widthCm: number, lengthCm: number): void {
    this.loading.set(true);
    this.error.set(false);
    this.service.suggestShelters(widthCm, lengthCm).subscribe({
      next: results => {
        this.suggestions.set(results);
        this.loading.set(false);
      },
      error: () => {
        this.suggestions.set([]);
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
