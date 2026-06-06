import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { publicGuard } from './core/guards/public.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent),
    title: 'AbrisTempo Local — Accueil',   // title est utilisé par le router pour WCAG 2.4.2
  },
  // {
  //   path: 'boutique',
  //   loadChildren: () => import('./features/shop/shop.routes').then(m => m.SHOP_ROUTES),
  // },
  // {
  //   path: 'location',
  //   loadChildren: () => import('./features/rental/rental.routes').then(m => m.RENTAL_ROUTES),
  // },
  // {
  //   path: 'installation',
  //   canActivate: [authGuard],
  //   loadChildren: () => import('./features/booking/booking.routes').then(m => m.BOOKING_ROUTES),
  // },
  // {
  //   path: 'mon-compte',
  //   canActivate: [authGuard],
  //   loadChildren: () => import('./features/account/account.routes').then(m => m.ACCOUNT_ROUTES),
  // },
  // {
  //   path: 'admin',
  //   canActivate: [authGuard, adminGuard],
  //   loadChildren: () => import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES),
  // },
  // {
  //   path: 'auth',
  //   canActivate: [publicGuard],
  //   loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),
  // },
  { path: '**', redirectTo: '' },
];
