import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  DimensionConfiguratorComponent,
  ShelterConfiguration,
} from '../dimension-configurator/dimension-configurator';
import { CartService } from '../../../core/services/cart.service';
import { formatFeetInches } from '../../mesurer/util/feet-inches.util';

/**
 * Page AUTONOME du configurateur de dimensions (EPIC 9.3, route `/boutique/configurer/:slug`).
 * Fournit l'ossature de page (h1, fil d'Ariane) et héberge `<app-dimension-configurator>`.
 * `slug` (du MODÈLE paramétrique) est lié depuis la route (`withComponentInputBinding`).
 *
 * EPIC 9.4 : mémorise la dernière configuration émise et l'ajoute au panier. Le configurateur
 * n'émet une `ShelterConfiguration` qu'APRÈS un prix serveur confirmé (source unique L-004) :
 * `configuration() !== null` équivaut donc à « prix serveur confirmé ». Le bouton d'ajout reste
 * FOCUSABLE mais `aria-disabled` tant qu'aucun prix n'est confirmé (L-024 : explication
 * atteignable au clavier), et l'ajout est confirmé via une live region (état neutre avant
 * réannonce — L-027).
 */
@Component({
  selector: 'app-configure-shelter',
  templateUrl: './configure-shelter.html',
  styleUrl: './configure-shelter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CurrencyPipe, DimensionConfiguratorComponent],
})
export class ConfigureShelterComponent {
  private readonly cart = inject(CartService);

  /** Slug du modèle paramétrique à configurer, lié à la route. */
  readonly slug = input.required<string>();

  /** Dernière configuration retenue (prix serveur confirmé) — null tant qu'aucun prix confirmé. */
  protected readonly configuration = signal<ShelterConfiguration | null>(null);

  /** Vrai dès qu'une config (donc un prix serveur) est confirmée → bouton réellement actif. */
  protected readonly canAdd = computed(() => this.configuration() !== null);

  /** Annonce d'ajout au panier (aria-live) — repassée à '' avant chaque réannonce (L-027). */
  protected readonly addAnnouncement = signal('');

  protected formatFeetInches = formatFeetInches;

  protected onConfigurationChange(config: ShelterConfiguration): void {
    this.configuration.set(config);
  }

  /** Ajoute l'abri configuré au panier. No-op tant qu'aucun prix serveur n'est confirmé (L-024). */
  protected addToCart(): void {
    const config = this.configuration();
    if (config === null) return;
    this.cart.addShelter(config);
    const length = this.formatFeetInches(config.lengthCm);
    this.addAnnouncement.set('');
    this.addAnnouncement.set(
      $localize`:@@shop.configure.addedAnnounce:${config.modelName}:model: (${length}:length:) ajouté au panier.`,
    );
  }
}
