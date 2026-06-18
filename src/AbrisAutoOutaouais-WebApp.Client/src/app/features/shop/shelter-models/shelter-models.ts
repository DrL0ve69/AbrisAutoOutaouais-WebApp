import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { ShelterService } from '../../../core/services/shelter.service';
import { ShelterModelSummary } from '../../../core/models/shelter.model';
import { formatFeetInches } from '../../mesurer/util/feet-inches.util';

/**
 * Liste des modèles d'abris PARAMÉTRIQUES d'une catégorie (EPIC 9.3, étape 5). Atterrissage du
 * CTA « Configurer les dimensions » du catalogue ; chaque carte mène au configurateur autonome
 * (`/boutique/configurer/:slug`). `category` est lié depuis le paramètre de route
 * (`withComponentInputBinding`). Le prix affiché est le prix de BASE (« à partir de »).
 */
@Component({
  selector: 'app-shelter-models',
  templateUrl: './shelter-models.html',
  styleUrl: './shelter-models.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CurrencyPipe],
})
export class ShelterModelsComponent implements OnInit {
  private readonly shelterService = inject(ShelterService);

  /** Slug de catégorie paramétrique (`abris-simples` / `abris-doubles`), lié à la route. */
  readonly category = input.required<string>();

  protected readonly models = signal<ShelterModelSummary[]>([]);
  protected readonly loading = signal(true);

  protected formatFeetInches = formatFeetInches;

  /** Annonce de résultats pour les lecteurs d'écran (role="status"). */
  protected readonly resultsLabel = computed(() => {
    const n = this.models().length;
    return n === 0
      ? $localize`:@@shop.models.resultsNone:Aucun modèle configurable dans cette catégorie.`
      : n === 1
        ? $localize`:@@shop.models.resultsOne:1 modèle configurable.`
        : $localize`:@@shop.models.resultsMany:${n}:count: modèles configurables.`;
  });

  ngOnInit(): void {
    this.shelterService.getModels(this.category()).subscribe({
      next: models => {
        this.models.set(models);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
