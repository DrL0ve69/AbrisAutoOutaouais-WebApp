import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  Footprint,
  footprintForVehicles,
  footprintFromManual,
} from '../../../util/footprint.util';
import { isRadioNavKey, nextRadioIndex } from '../../../util/radio-nav.util';
import { feetToCm } from '../../../util/units.util';
import { VehicleType } from '../../../util/vehicle-dims.const';

interface VehicleRow {
  readonly type: VehicleType;
  readonly label: string;
}

/**
 * Calculateur de gabarit par véhicule(s) — alternative ENTIÈREMENT clavier à la carte
 * (SSR-safe : aucune dépendance Leaflet/turf). Deux modes :
 *  - « véhicules » : pour chaque type, une quantité (0 = ignoré) → `footprintForVehicles`.
 *  - « manuel »    : largeur/longueur saisies → `footprintFromManual`.
 *
 * Émet `footprintComputed` uniquement quand le gabarit est DANS la plage `[1, 2000]`
 * exigée par D2 ; au-delà, on affiche un message accessible et on n'émet rien (pas d'appel).
 *
 * Unités : la SAISIE manuelle est en PIEDS (ce que mesure un propriétaire), convertie en cm
 * (canonique) via `feetToCm` avant `footprintFromManual` — voir `units.util`. Les dimensions
 * véhicules restent en cm (constante interne, l'utilisateur ne les saisit pas).
 *
 * L-014 : les contrôles numériques sont créés via `fb.control<number | null>(null, [...])`
 * — JAMAIS un tuple `[value, validators]` qui casserait le typage `nonNullable`.
 */
@Component({
  selector: 'app-vehicle-calculator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './vehicle-calculator.html',
  styleUrl: './vehicle-calculator.scss',
})
export class VehicleCalculatorComponent {
  private readonly fb = new FormBuilder();

  /** Gabarit prêt pour l'étape résultats (toujours dans la plage `[1, 2000]`). */
  readonly footprintComputed = output<Footprint>();

  /** Mode de saisie courant : par véhicules (défaut) ou manuel. */
  protected readonly mode = signal<'vehicles' | 'manual'>('vehicles');

  /** Ordre des options du radiogroup (roving tabindex + navigation flèches, APG). */
  protected readonly modes = ['vehicles', 'manual'] as const;

  /** Boutons radio de mode (ordre DOM) pour déplacer le focus au clavier. */
  private readonly modeRadios = viewChildren<ElementRef<HTMLButtonElement>>('modeRadio');

  /** Message « hors plage » à annoncer si le gabarit dépasse les bornes D2. */
  protected readonly outOfRange = signal(false);

  /** Lignes de véhicules : libellés i18n ici (la const ne porte que les dimensions). */
  protected readonly vehicleRows: readonly VehicleRow[] = [
    { type: 'compact', label: $localize`:@@mesurer.vehicle.compact:Compacte` },
    { type: 'berline', label: $localize`:@@mesurer.vehicle.berline:Berline` },
    { type: 'vus', label: $localize`:@@mesurer.vehicle.vus:VUS` },
    { type: 'pickup', label: $localize`:@@mesurer.vehicle.pickup:Camionnette` },
    {
      type: 'fourgonnette',
      label: $localize`:@@mesurer.vehicle.fourgonnette:Fourgonnette`,
    },
  ];

  /** Un contrôle de quantité (entier 0..6) par type de véhicule. */
  protected readonly vehiclesForm = this.fb.group({
    compact: this.fb.control<number | null>(0, [Validators.min(0), Validators.max(6)]),
    berline: this.fb.control<number | null>(0, [Validators.min(0), Validators.max(6)]),
    vus: this.fb.control<number | null>(0, [Validators.min(0), Validators.max(6)]),
    pickup: this.fb.control<number | null>(0, [Validators.min(0), Validators.max(6)]),
    fourgonnette: this.fb.control<number | null>(0, [Validators.min(0), Validators.max(6)]),
  });

  /**
   * Saisie manuelle en PIEDS — bornée 1..65 pi par les validateurs (65 pi ≈ 1981 cm, sous la
   * borne serveur de 2000 cm). Convertie en cm avant le calcul (L-014 : pas de tuple spread).
   */
  protected readonly manualForm = this.fb.group({
    widthFt: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(1),
      Validators.max(65),
    ]),
    lengthFt: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(1),
      Validators.max(65),
    ]),
  });

  protected get mf() {
    return this.manualForm.controls;
  }

  protected setMode(mode: 'vehicles' | 'manual'): void {
    this.mode.set(mode);
    this.outOfRange.set(false);
  }

  /** Navigation APG du radiogroup de mode : flèches/Home/End déplacent ET sélectionnent. */
  protected onModeKeydown(event: KeyboardEvent): void {
    // Ne pas détourner les raccourcis navigateur (Ctrl/Alt/Meta + flèche).
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (!isRadioNavKey(event.key)) return;
    event.preventDefault();
    const current = this.modes.indexOf(this.mode());
    const next = nextRadioIndex(event.key, current, this.modes.length);
    this.setMode(this.modes[next]);
    // Les deux boutons existent toujours dans le DOM → focus synchrone sûr.
    this.modeRadios()[next]?.nativeElement.focus();
  }

  protected computeVehicles(): void {
    const v = this.vehiclesForm.getRawValue();
    const footprint = footprintForVehicles([
      { type: 'compact', quantity: v.compact ?? 0 },
      { type: 'berline', quantity: v.berline ?? 0 },
      { type: 'vus', quantity: v.vus ?? 0 },
      { type: 'pickup', quantity: v.pickup ?? 0 },
      { type: 'fourgonnette', quantity: v.fourgonnette ?? 0 },
    ]);
    this.emit(footprint);
  }

  protected computeManual(): void {
    if (this.manualForm.invalid) {
      this.manualForm.markAllAsTouched();
      this.outOfRange.set(false);
      return;
    }
    const v = this.manualForm.getRawValue();
    // Pieds (saisie) → cm (canonique) avant le calcul/borne et l'appel D2.
    this.emit(footprintFromManual(feetToCm(v.widthFt ?? 0), feetToCm(v.lengthFt ?? 0)));
  }

  private emit(footprint: Footprint): void {
    if (footprint.outOfRange) {
      this.outOfRange.set(true);
      return;
    }
    this.outOfRange.set(false);
    this.footprintComputed.emit(footprint);
  }
}
