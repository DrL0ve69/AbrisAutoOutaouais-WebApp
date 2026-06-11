import { Routes } from '@angular/router';
import { AUTH_ROUTES } from './features/auth/auth.routes';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { publicGuard } from './core/guards/public.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then(m => m.HomeComponent),
    title: 'AbrisTempo Local — Accueil',   // title est utilisé par le router pour WCAG 2.4.2
  },
  // {
  //   path: AUTH_ROUTES[0].path,
  //   loadComponent: AUTH_ROUTES[0].loadComponent,
  //   title: AUTH_ROUTES[0].title,
  // },
  // ── Redirections des anciens chemins ──────────────────────────
  { path: 'login', redirectTo: '/auth', pathMatch: 'full' },
  { path: 'register', redirectTo: '/auth', pathMatch: 'full' },
  {
    path: 'me',
    loadComponent: () => import('./features/auth/me/profile').then(m => m.ProfileComponent),
    canActivate: [authGuard],
    title: 'AbrisTempo Local — Mon Compte',   // title est utilisé par le router pour WCAG 2.4.2
  },
  // ── Ancienne route /me → redirection ─────────────────────────
  // { path: 'me', redirectTo: '/mon-compte/profil', pathMatch: 'full' },
  {
    path: 'boutique',
    loadChildren: () => import('./features/shop/shop.routes').then(m => m.SHOP_ROUTES),
  },
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
  // ── Auth (connexion + inscription, flip card) ─────────────────
  // publicGuard redirige vers '/' si l'utilisateur est déjà connecté
  {
    path: 'auth',
    canActivate: [publicGuard],
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },
  // ── Mon compte (profil, commandes, réservations) ─────────────
  {
    path: 'mon-compte',
    canActivate: [authGuard],
    loadChildren: () => import('./features/account/account.routes').then(m => m.ACCOUNT_ROUTES),
  },
  // {
  //   path: 'projects/accessible-components',
  //   loadComponent: () =>
  //     import('./shared/components/a11y-components/a11y-components.component')
  //       .then(m => m.A11yComponentsPageComponent),
  //   title: 'Composants accessibles — Philippe Charron',
  // },
  { path: '**', redirectTo: '' },
];
