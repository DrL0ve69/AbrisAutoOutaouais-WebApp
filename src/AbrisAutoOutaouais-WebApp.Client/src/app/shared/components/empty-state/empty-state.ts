import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Bloc « état vide » réutilisable (aucune donnée à afficher).
 * Accessible : annoncé via role="status", icône décorative masquée.
 */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty-state" role="status">
      <p class="empty-state__icon" aria-hidden="true">{{ icon() }}</p>
      <p class="empty-state__text">{{ message() }}</p>
      @if (hint()) {
      <p class="empty-state__hint">{{ hint() }}</p>
      }
    </div>
  `,
  styles: `
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      text-align: center;
      padding: var(--space-12) var(--space-4);
      background: var(--color-surface, #fff);
      border: 1px dashed var(--color-border-strong);
      border-radius: var(--radius-xl);
    }
    .empty-state__icon {
      font-size: 2.75rem;
      line-height: 1;
    }
    .empty-state__text {
      font-family: var(--font-display);
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-bold);
      color: var(--color-text);
    }
    .empty-state__hint {
      font-size: var(--font-size-sm);
      color: var(--color-text-muted);
      max-width: 44ch;
      line-height: var(--line-height-relaxed);
    }
  `,
})
export class EmptyStateComponent {
  readonly icon = input('📭');
  readonly message = input.required<string>();
  readonly hint = input<string | null>(null);
}
