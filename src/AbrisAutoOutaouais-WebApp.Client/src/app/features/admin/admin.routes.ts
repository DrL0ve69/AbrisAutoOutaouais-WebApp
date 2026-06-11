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
    path: 'commandes',
    loadComponent: () =>
      import('./orders/orders').then(m => m.AdminOrdersComponent),
    title: 'AbrisTempo Local — Gestion des commandes',
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'dashboard' },
];
