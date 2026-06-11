import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Page « en construction » pour la location d'abris.
 * Placeholder accessible en attendant la fonctionnalité complète.
 */
@Component({
  selector: 'app-location',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="construction" aria-labelledby="location-heading">
      <div class="container container--narrow construction__inner">
        <p class="construction__eyebrow" i18n="@@location.eyebrow">Bientôt disponible</p>
        <h1 id="location-heading" i18n="@@location.title">Location d'abris — page en construction</h1>
        <p class="construction__lead" i18n="@@location.body">
          Notre service de location saisonnière d'abris arrive bientôt. En attendant,
          parcourez notre boutique ou contactez-nous pour toute question.
        </p>
        <a routerLink="/" class="btn btn--primary" i18n="@@location.back">
          Retour à l'accueil
        </a>
      </div>
    </section>
  `,
  styles: `
    .construction {
      padding: calc(68px + var(--space-16)) 0 var(--space-24);
      min-height: 70vh;
      display: flex;
      align-items: center;
    }
    .construction__inner {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-5);
    }
    .construction__eyebrow {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-bold);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-primary);
    }
    .construction__lead {
      color: var(--color-text-secondary);
      line-height: var(--line-height-relaxed);
      max-width: 48ch;
    }
  `,
})
export class LocationComponent {}
