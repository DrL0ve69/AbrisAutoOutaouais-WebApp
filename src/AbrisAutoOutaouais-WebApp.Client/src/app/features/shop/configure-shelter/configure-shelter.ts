import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  DimensionConfiguratorComponent,
  ShelterConfiguration,
} from '../dimension-configurator/dimension-configurator';

/**
 * Page AUTONOME du configurateur de dimensions (EPIC 9.3, route `/boutique/configurer/:slug`).
 * Fournit l'ossature de page (h1, fil d'Ariane) et héberge `<app-dimension-configurator>`.
 * `slug` (du MODÈLE paramétrique) est lié depuis la route (`withComponentInputBinding`).
 * Mémorise la dernière configuration émise — relais vers l'ajout au panier en 9.4.
 */
@Component({
  selector: 'app-configure-shelter',
  templateUrl: './configure-shelter.html',
  styleUrl: './configure-shelter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DimensionConfiguratorComponent],
})
export class ConfigureShelterComponent {
  /** Slug du modèle paramétrique à configurer, lié à la route. */
  readonly slug = input.required<string>();

  /** Dernière configuration retenue (prête pour l'ajout au panier — 9.4). */
  protected readonly configuration = signal<ShelterConfiguration | null>(null);

  protected onConfigurationChange(config: ShelterConfiguration): void {
    this.configuration.set(config);
  }
}
