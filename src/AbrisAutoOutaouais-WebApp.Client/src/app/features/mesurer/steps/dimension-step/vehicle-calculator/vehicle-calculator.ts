import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Footprint } from '../../../util/footprint.util';
import {
  ParkingOrientation,
  footprintForVehiclesOriented,
} from '../../../util/orientation.util';
import { isRadioNavKey, nextRadioIndex } from '../../../util/radio-nav.util';
import { VehicleType } from '../../../util/vehicle-dims.const';

interface VehicleRow {
  readonly type: VehicleType;
  readonly label: string;
}

/**
 * Calculateur de gabarit par véhicule(s) — voie ENTIÈREMENT clavier (SSR-safe : aucune
 * dépendance Leaflet/turf), branchée par la voie « par véhicules » de l'étape Dimensionner.
 *
 * Pour chaque type de véhicule, une quantité (0 = ignoré) → `footprintForVehiclesOriented`,
 * avec une orientation (côte à côte / l'un derrière l'autre, US-10.2) visible dès ≥ 2 véhicules.
 *
 * (EPIC 13.1) L'ancien sélecteur de mode « véhicules / manuel » a été RETIRÉ : la saisie
 * manuelle est promue en voie à part entière (`known-dimensions`), choisie en amont par le
 * radiogroup à 3 voies de l'étape Dimensionner.
 *
 * Émet `footprintComputed` uniquement quand le gabarit est DANS la plage `[1, 2000]` exigée
 * par la suggestion d'abris ; au-delà, on affiche un message accessible et on n'émet rien.
 *
 * Unités : les dimensions véhicules sont en cm (constante interne, l'utilisateur ne les saisit pas).
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

  /** Gabarit prêt pour l'étape Conseil (toujours dans la plage `[1, 2000]`). */
  readonly footprintComputed = output<Footprint>();

  // ── Orientation du stationnement (US-10.2) ───────────────────────────────────
  /** Orientation courante : côte à côte (défaut) ou les uns derrière les autres. */
  protected readonly orientation = signal<ParkingOrientation>('side-by-side');

  /** Ordre des options du radiogroup d'orientation (roving tabindex + flèches, APG). */
  protected readonly orientations = ['side-by-side', 'behind'] as const;

  /** Boutons radio d'orientation (ordre DOM) pour déplacer le focus au clavier. */
  private readonly orientationRadios = viewChildren<ElementRef<HTMLButtonElement>>('orientationRadio');

  /** Libellés i18n des orientations (affichage). */
  protected readonly orientationLabels: Readonly<Record<ParkingOrientation, string>> = {
    'side-by-side': $localize`:@@mesurer.calc.orientationSideBySide:Côte à côte`,
    behind: $localize`:@@mesurer.calc.orientationBehind:L'un derrière l'autre`,
  };

  /** Message « hors plage » à annoncer si le gabarit dépasse les bornes serveur. */
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

  /** Total de véhicules sélectionnés (signal réactif sur le formulaire) pour piloter l'affichage. */
  protected readonly totalVehicles = signal(0);

  constructor() {
    // Maintient `totalVehicles` à jour à chaque changement de quantité (réactif sans CD manuel).
    this.vehiclesForm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(v =>
        this.totalVehicles.set(
          (v.compact ?? 0) + (v.berline ?? 0) + (v.vus ?? 0) + (v.pickup ?? 0) + (v.fourgonnette ?? 0),
        ),
      );
  }

  /**
   * Le sélecteur d'orientation n'a de sens qu'avec ≥ 2 véhicules
   * (un seul véhicule ⇒ orientation sans effet sur le gabarit).
   */
  protected readonly showOrientation = computed(() => this.totalVehicles() >= 2);

  protected setOrientation(orientation: ParkingOrientation): void {
    this.orientation.set(orientation);
  }

  /** Navigation APG du radiogroup d'orientation : flèches/Home/End déplacent ET sélectionnent. */
  protected onOrientationKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (!isRadioNavKey(event.key)) return;
    event.preventDefault();
    const current = this.orientations.indexOf(this.orientation());
    const next = nextRadioIndex(event.key, current, this.orientations.length);
    this.setOrientation(this.orientations[next]);
    // Les deux boutons existent toujours dans le DOM (mêmes conditions d'affichage) → focus synchrone sûr.
    this.orientationRadios()[next]?.nativeElement.focus();
  }

  protected computeVehicles(): void {
    const v = this.vehiclesForm.getRawValue();
    const footprint = footprintForVehiclesOriented(
      [
        { type: 'compact', quantity: v.compact ?? 0 },
        { type: 'berline', quantity: v.berline ?? 0 },
        { type: 'vus', quantity: v.vus ?? 0 },
        { type: 'pickup', quantity: v.pickup ?? 0 },
        { type: 'fourgonnette', quantity: v.fourgonnette ?? 0 },
      ],
      this.orientation(),
    );
    this.emit(footprint);
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
