import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * /conditions — Conditions d'utilisation.
 * Page de contenu statique : aucune logique, prose accessible
 * (h1 unique, hiérarchie h2, longueur de ligne lisible).
 * Rendue dans le <main> de la coquille applicative — pas de landmark ici.
 */
@Component({
  selector: 'app-conditions',
  templateUrl: './conditions.html',
  styleUrl: './conditions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConditionsComponent {}
