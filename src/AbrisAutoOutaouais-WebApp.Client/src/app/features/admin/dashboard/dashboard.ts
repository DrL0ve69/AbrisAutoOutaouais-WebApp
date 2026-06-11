import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface AdminSection {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly icon: string;
}

/**
 * Tableau de bord administrateur — coquille (shell).
 * Présente les sections d'administration sous forme de cartes
 * « Section en construction » (aucun CRUD backend pour l'instant).
 * Accès protégé par authGuard + adminGuard (cf. app.routes.ts).
 */
@Component({
  selector: 'app-admin-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="admin" aria-labelledby="admin-heading">
      <div class="container">
        <header class="admin__head">
          <p class="admin__eyebrow" i18n="@@admin.eyebrow">Espace réservé</p>
          <h1 id="admin-heading" i18n="@@admin.title">Tableau de bord administrateur</h1>
          <p class="admin__lead" i18n="@@admin.lead">
            Gérez le catalogue, les commandes et les utilisateurs d'AbrisTempo Local.
            Les modules ci-dessous arrivent prochainement.
          </p>
        </header>

        <ul class="admin__grid" role="list" aria-label="Sections d'administration"
            i18n-aria-label="@@admin.sectionsLabel">
          @for (section of sections; track section.id) {
          <li>
            <article class="admin-card" [attr.aria-labelledby]="'card-' + section.id">
              <p class="admin-card__icon" aria-hidden="true">{{ section.icon }}</p>
              <h2 [id]="'card-' + section.id" class="admin-card__title">{{ section.label }}</h2>
              <p class="admin-card__desc">{{ section.description }}</p>
              <p class="admin-card__badge" i18n="@@admin.card.soon">Section en construction</p>
            </article>
          </li>
          }
        </ul>

        <a routerLink="/" class="admin__back" i18n="@@admin.back">
          ← Retour au site
        </a>
      </div>
    </section>
  `,
  styleUrl: './dashboard.scss',
})
export class AdminDashboardComponent {
  protected readonly sections: readonly AdminSection[] = [
    {
      id: 'products',
      label: $localize`:@@admin.section.products:Produits`,
      description: $localize`:@@admin.section.productsDesc:Ajouter, modifier et retirer des abris du catalogue.`,
      icon: '📦',
    },
    {
      id: 'orders',
      label: $localize`:@@admin.section.orders:Commandes`,
      description: $localize`:@@admin.section.ordersDesc:Suivre et traiter les commandes des clients.`,
      icon: '🧾',
    },
    {
      id: 'users',
      label: $localize`:@@admin.section.users:Utilisateurs`,
      description: $localize`:@@admin.section.usersDesc:Gérer les comptes et les rôles des utilisateurs.`,
      icon: '👥',
    },
    {
      id: 'reservations',
      label: $localize`:@@admin.section.reservations:Réservations`,
      description: $localize`:@@admin.section.reservationsDesc:Planifier les installations et les locations d'abris.`,
      icon: '📅',
    },
  ];
}
