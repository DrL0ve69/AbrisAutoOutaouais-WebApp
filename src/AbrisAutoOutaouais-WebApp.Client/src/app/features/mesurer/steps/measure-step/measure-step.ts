import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { Footprint } from '../../util/footprint.util';
import { VehicleCalculatorComponent } from './vehicle-calculator/vehicle-calculator';
import { MapMeasureComponent } from './map-measure/map-measure';

/**
 * Étape 2 « Mesure » — choix entre deux méthodes pour obtenir le gabarit :
 *  - Calculateur de véhicules (DÉFAUT) : entièrement clavier, SSR-safe, équivalent accessible.
 *  - Carte satellite : dessin pointer-only (Leaflet/geoman), chargée en `@defer (on viewport)`.
 *
 * Le défaut sur le calculateur garantit qu'un utilisateur au clavier dispose immédiatement
 * d'un chemin complet sans dépendre de la carte. Émet `footprintComputed` vers le shell.
 */
@Component({
  selector: 'app-measure-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [VehicleCalculatorComponent, MapMeasureComponent],
  templateUrl: './measure-step.html',
  styleUrl: './measure-step.scss',
})
export class MeasureStepComponent {
  /** Coordonnées de l'adresse choisie (centre de la carte). */
  readonly lat = input<number | null>(null);
  readonly lng = input<number | null>(null);

  /** Gabarit calculé (toujours dans la plage `[1, 2000]`). */
  readonly footprintComputed = output<Footprint>();

  protected readonly method = signal<'calculator' | 'map'>('calculator');

  protected setMethod(method: 'calculator' | 'map'): void {
    this.method.set(method);
  }

  protected onFootprint(footprint: Footprint): void {
    this.footprintComputed.emit(footprint);
  }
}
