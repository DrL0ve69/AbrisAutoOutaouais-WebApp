import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

@Component({
  selector: 'app-alert',
  templateUrl: './alert.html',
  styleUrl: './alert.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Rôle et aria sur l'hôte — WCAG 4.1.3 Status Messages
  host: {
    'role': 'alert',          // Annonce immédiatement aux lecteurs d'écran
    'aria-live': 'assertive',      // 'polite' pour les succès, 'assertive' pour les erreurs
    'aria-atomic': 'true',
  },
})
export class AlertComponent {
  readonly type = input<AlertType>('info');
  readonly message = input.required<string>();
}
