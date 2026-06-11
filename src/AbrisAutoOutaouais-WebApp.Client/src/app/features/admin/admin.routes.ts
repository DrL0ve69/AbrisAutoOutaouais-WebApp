import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/dashboard').then(m => m.AdminDashboardComponent),
    title: 'AbrisTempo Local — Tableau de bord administrateur',
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'dashboard' },
];
