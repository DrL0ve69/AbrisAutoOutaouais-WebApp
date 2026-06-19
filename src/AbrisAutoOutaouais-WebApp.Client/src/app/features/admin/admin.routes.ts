import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/dashboard').then(m => m.AdminDashboardComponent),
    title: 'AbrisTempo Local — Tableau de bord administrateur',
  },
  {
    path: 'produits',
    loadComponent: () =>
      import('./products/products').then(m => m.AdminProductsComponent),
    title: 'AbrisTempo Local — Gestion des produits',
  },
  {
    path: 'modeles-abris',
    loadComponent: () =>
      import('./shelter-models/shelter-models').then(m => m.AdminShelterModelsComponent),
    title: "AbrisTempo Local — Gestion des modèles d'abris",
  },
  {
    path: 'commandes',
    loadComponent: () =>
      import('./orders/orders').then(m => m.AdminOrdersComponent),
    title: 'AbrisTempo Local — Gestion des commandes',
  },
  {
    path: 'reservations',
    loadComponent: () =>
      import('./bookings/bookings').then(m => m.AdminBookingsComponent),
    title: 'AbrisTempo Local — Gestion des réservations',
  },
  {
    path: 'locations',
    loadComponent: () =>
      import('./rentals/rentals').then(m => m.AdminRentalsComponent),
    title: 'AbrisTempo Local — Gestion des locations',
  },
  {
    path: 'utilisateurs',
    loadComponent: () =>
      import('./users/users').then(m => m.AdminUsersComponent),
    title: 'AbrisTempo Local — Liste des utilisateurs',
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'dashboard' },
];
