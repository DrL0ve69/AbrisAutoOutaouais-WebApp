import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * /confidentialite — Politique de confidentialité (Loi 25, Québec).
 * Page de contenu statique : aucune logique, prose accessible
 * (h1 unique, hiérarchie h2, longueur de ligne lisible).
 * Rendue dans le <main> de la coquille applicative — pas de landmark ici.
 */
@Component({
  selector: 'app-confidentialite',
  templateUrl: './confidentialite.html',
  styleUrl: './confidentialite.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfidentialiteComponent {}
