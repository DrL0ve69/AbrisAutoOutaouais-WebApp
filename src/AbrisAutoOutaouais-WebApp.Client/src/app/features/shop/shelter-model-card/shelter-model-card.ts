import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ShelterModelSummary } from '../../../core/models/shelter.model';
import { formatFeetInches } from '../../mesurer/util/feet-inches.util';

/**
 * Élément déclencheur d'ouverture de l'overlay de configuration : le slug du modèle + le bouton
 * « Ajouter au panier » qui l'a ouvert (pour le RETOUR de focus à la fermeture — WCAG 2.4.3).
 */
export interface ShelterConfigureRequest {
  readonly slug: string;
  readonly modelName: string;
  /** Bouton à re-focaliser quand l'overlay se ferme. */
  readonly trigger: HTMLElement;
}

/**
 * Carte d'un modèle d'abri PARAMÉTRIQUE dans le catalogue (rework EPIC 9). Affiche le nom, le
 * prix « à partir de » (prix de BASE) et un bouton « Ajouter au panier » qui demande au parent
 * d'OUVRIR l'overlay de configuration pour ce modèle. Le bouton transmet son propre élément DOM
 * comme déclencheur, pour que l'overlay rende le focus à la fermeture (L-006).
 *
 * Jetons sémantiques uniquement (contraste validé en e2e dual-thème — L-016).
 */
@Component({
  selector: 'app-shelter-model-card',
  templateUrl: './shelter-model-card.html',
  styleUrl: './shelter-model-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe],
})
export class ShelterModelCardComponent {
  readonly model = input.required<ShelterModelSummary>();

  /** Demande l'ouverture de l'overlay pour ce modèle (avec le déclencheur pour le retour de focus). */
  readonly configure = output<ShelterConfigureRequest>();

  protected formatFeetInches = formatFeetInches;

  /**
   * Libellé accessible du bouton. Le binding est DYNAMIQUE (`[attr.aria-label]`) : `i18n-aria-label`
   * ne s'applique pas (extracteur i18n = attributs STATIQUES uniquement) → `$localize` avec id
   * explicite et placeholder nommé (L-024). À maintenir dans les DEUX catalogues (L-018).
   */
  protected addAriaLabel(): string {
    return $localize`:@@shop.modelCard.addAria:Configurer et ajouter au panier — ${this.model().name}:name:`;
  }

  protected onConfigure(event: MouseEvent): void {
    const m = this.model();
    this.configure.emit({
      slug: m.slug,
      modelName: m.name,
      trigger: event.currentTarget as HTMLElement,
    });
  }
}
