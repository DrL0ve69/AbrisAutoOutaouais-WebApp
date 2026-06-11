import { Routes } from '@angular/router';

export const ACCOUNT_ROUTES: Routes = [
  {
    path: 'profil',
    loadComponent: () =>
      import('./profile/profile').then(m => m.ProfileComponent),
    title: 'AbrisTempo Local — Mon profil',
  },
  // {
  //   path:          'commandes',
  //   loadComponent: () => import('./my-orders/my-orders').then(m => m.MyOrdersComponent),
  //   title:         'AbrisTempo Local — Mes commandes',
  // },
  // {
  //   path:          'reservations',
  //   loadComponent: () => import('./my-bookings/my-bookings').then(m => m.MyBookingsComponent),
  //   title:         'AbrisTempo Local — Mes réservations',
  // },
  // {
  //   path:          'locations',
  //   loadComponent: () => import('./my-rentals/my-rentals').then(m => m.MyRentalsComponent),
  //   title:         'AbrisTempo Local — Mes locations',
  // },
  { path: '', redirectTo: 'profil', pathMatch: 'full' },
  { path: '**', redirectTo: 'profil' },
];
