import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Validators } from '@angular/forms';
import { Footprint, footprintFromManual } from '../../../util/footprint.util';
import { feetToCm } from '../../../util/units.util';

/**
 * Voie « je connais mes dimensions » (EPIC 13, sous-tâche 13.1) — saisie directe de la
 * largeur et de la longueur du stationnement, en PIEDS (ce que mesure un propriétaire).
 *
 * Cette voie reprend la logique de l'ancien mode « manuel » du calculateur de véhicules
 * (promu ici en voie à part entière) : pieds (saisie) → cm (canonique) via `feetToCm`, puis
 * `footprintFromManual` borne/arrondit dans la plage `[1, 2000]` cm exigée par `/shelters/suggest`.
 * Au-delà des bornes, on n'émet rien et on affiche un message accessible (`outOfRange`).
 *
 * L-014 : les contrôles numériques sont créés via `fb.control<number | null>(null, [...])`
 * — JAMAIS un tuple `[value, validators]` qui casserait le typage `nonNullable`.
 */
@Component({
  selector: 'app-known-dimensions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './known-dimensions.html',
  styleUrl: './known-dimensions.scss',
})
export class KnownDimensionsComponent {
  private readonly fb = new FormBuilder();

  /** Gabarit prêt pour l'étape Conseil (toujours dans la plage `[1, 2000]`). */
  readonly footprintComputed = output<Footprint>();

  /** Message « hors plage » à annoncer si le gabarit dépasse les bornes serveur. */
  protected readonly outOfRange = signal(false);

  /**
   * Saisie en PIEDS — bornée 1..65 pi par les validateurs (65 pi ≈ 1981 cm, sous la borne
   * serveur de 2000 cm). Convertie en cm avant le calcul (L-014 : pas de tuple spread).
   */
  protected readonly form = this.fb.group({
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

  protected get f() {
    return this.form.controls;
  }

  protected compute(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.outOfRange.set(false);
      return;
    }
    const v = this.form.getRawValue();
    // Pieds (saisie) → cm (canonique) avant la borne et l'appel suggestion.
    const footprint = footprintFromManual(feetToCm(v.widthFt ?? 0), feetToCm(v.lengthFt ?? 0));
    if (footprint.outOfRange) {
      this.outOfRange.set(true);
      return;
    }
    this.outOfRange.set(false);
    this.footprintComputed.emit(footprint);
  }
}
