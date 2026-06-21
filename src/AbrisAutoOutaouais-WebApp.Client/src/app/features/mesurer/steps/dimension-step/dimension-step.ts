import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { Footprint } from '../../util/footprint.util';
import { isRadioNavKey, nextRadioIndex } from '../../util/radio-nav.util';
import { KnownDimensionsComponent } from './known-dimensions/known-dimensions';
import { VehicleCalculatorComponent } from './vehicle-calculator/vehicle-calculator';
import { MapVoieComponent } from './map-voie/map-voie';

/** Les trois voies pour obtenir le gabarit du stationnement. */
type DimensionMethod = 'known' | 'vehicles' | 'map';

/**
 * Étape 1 « Dimensionner » (EPIC 13, sous-tâche 13.1) — radiogroup APG à 3 voies pour obtenir
 * le gabarit du stationnement :
 *  - `known`    : l'utilisateur connaît ses dimensions (saisie largeur/longueur en pieds).
 *  - `vehicles` : calculateur par véhicule(s) — DÉFAUT (chemin clavier complet immédiat).
 *  - `map`      : mesure sur carte satellite (Leaflet/geoman, dessin pointer).
 *
 * Le défaut sur `vehicles` garantit qu'un utilisateur au clavier dispose immédiatement d'un
 * chemin complet sans dépendre de la carte. Émet `footprintComputed` vers le shell.
 *
 * Accessibilité :
 *  - Radiogroup conforme APG (L-015) via `radio-nav.util` : roving tabindex (un seul stop de
 *    groupe), flèches/Home/End déplacent ET sélectionnent. Les trois boutons sont des cibles
 *    STATIQUES toujours montées → focus synchrone après `set()` sûr.
 *  - Nom accessible du radiogroup NON vide (L-040) : libellé i18n statique (`aria-label`).
 *
 * (13.2) La voie `map` rend désormais `<app-map-voie>` : l'input adresse et la carte cohabitent
 * sur la même page (géocodage → centrage, zone de service → avertissement doux). Le gabarit
 * tracé remonte via `footprintComputed`.
 */
@Component({
  selector: 'app-dimension-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KnownDimensionsComponent, VehicleCalculatorComponent, MapVoieComponent],
  templateUrl: './dimension-step.html',
  styleUrl: './dimension-step.scss',
})
export class DimensionStepComponent {
  /** Gabarit calculé (toujours dans la plage `[1, 2000]`). */
  readonly footprintComputed = output<Footprint>();

  /** Voie courante : par véhicules par défaut (chemin clavier complet immédiat). */
  protected readonly method = signal<DimensionMethod>('vehicles');

  /** Ordre des options du radiogroup — sert au roving tabindex et à la navigation flèches. */
  protected readonly methods = ['known', 'vehicles', 'map'] as const;

  /** Libellés i18n des voies (affichage des boutons radio). */
  protected readonly methodLabels: Readonly<Record<DimensionMethod, string>> = {
    known: $localize`:@@mesurer.dimension.known:Je connais mes dimensions`,
    vehicles: $localize`:@@mesurer.dimension.vehicles:Par mes véhicules`,
    map: $localize`:@@mesurer.dimension.map:Mesurer sur la carte`,
  };

  /** Boutons radio (dans l'ordre du DOM) pour déplacer le focus au clavier (APG). */
  private readonly radios = viewChildren<ElementRef<HTMLButtonElement>>('methodRadio');

  protected setMethod(method: DimensionMethod): void {
    this.method.set(method);
  }

  /** Navigation APG du radiogroup : flèches/Home/End déplacent ET sélectionnent. */
  protected onMethodKeydown(event: KeyboardEvent): void {
    // Ne pas détourner les raccourcis navigateur (Ctrl/Alt/Meta + flèche).
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (!isRadioNavKey(event.key)) return;
    event.preventDefault();
    const current = this.methods.indexOf(this.method());
    const next = nextRadioIndex(event.key, current, this.methods.length);
    this.method.set(this.methods[next]);
    // Les trois boutons existent toujours dans le DOM → focus synchrone sûr (L-015).
    this.radios()[next]?.nativeElement.focus();
  }

  protected onFootprint(footprint: Footprint): void {
    this.footprintComputed.emit(footprint);
  }
}
