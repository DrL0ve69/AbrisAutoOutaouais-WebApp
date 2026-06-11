import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Page « en construction » pour la réservation d'installation.
 * Placeholder accessible en attendant la fonctionnalité complète.
 */
@Component({
  selector: 'app-installation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="construction" aria-labelledby="installation-heading">
      <div class="container container--narrow construction__inner">
        <p class="construction__eyebrow" i18n="@@installation.eyebrow">Bientôt disponible</p>
        <h1 id="installation-heading" i18n="@@installation.title">
          Réservation d'installation — page en construction
        </h1>
        <p class="construction__lead" i18n="@@installation.body">
          La réservation en ligne de votre installation à domicile arrive bientôt.
          En attendant, appelez-nous au 819 123-4567 pour planifier votre rendez-vous.
        </p>
        <a routerLink="/" class="btn btn--primary" i18n="@@installation.back">
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
export class InstallationComponent {}
