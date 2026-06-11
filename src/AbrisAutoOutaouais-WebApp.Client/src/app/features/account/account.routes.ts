import { Routes } from '@angular/router';

export const ACCOUNT_ROUTES: Routes = [
  {
    path: 'profil',
    loadComponent: () =>
      import('./profile/profile').then(m => m.ProfileComponent),
    title: 'AbrisTempo Local — Mon profil',
  },
  {
    path: 'commandes',
    loadComponent: () => import('./orders/orders').then(m => m.OrdersComponent),
    title: 'AbrisTempo Local — Mes commandes',
  },
  {
    path: 'reservations',
    loadComponent: () =>
      import('./reservations/reservations').then(m => m.ReservationsComponent),
    title: 'AbrisTempo Local — Mes réservations',
  },
  {
    path: 'locations',
    loadComponent: () => import('./rentals/rentals').then(m => m.RentalsComponent),
    title: 'AbrisTempo Local — Mes locations',
  },
  { path: '', redirectTo: 'profil', pathMatch: 'full' },
  { path: '**', redirectTo: 'profil' },
];
