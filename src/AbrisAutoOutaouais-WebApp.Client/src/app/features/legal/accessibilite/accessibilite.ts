import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * /accessibilite — Déclaration d'accessibilité (WCAG 2.2 AA).
 * Résume la démarche réelle du projet : audit documenté dans
 * docs/accessibility/wcag-2.2-audit.md (axe-core automatisé,
 * passes manuelles NVDA/VoiceOver, balayage de contraste bi-thème).
 * Page statique rendue dans le <main> de la coquille — pas de landmark ici.
 */
@Component({
  selector: 'app-accessibilite',
  templateUrl: './accessibilite.html',
  styleUrl: './accessibilite.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessibiliteComponent {}
