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
  // ── /me → redirection vers le profil canonique (account/profile) ─
  { path: 'me', redirectTo: '/mon-compte/profil', pathMatch: 'full' },
  {
    path: 'boutique',
    loadChildren: () => import('./features/shop/shop.routes').then(m => m.SHOP_ROUTES),
  },
  {
    path: 'panier',
    loadComponent: () => import('./features/cart/cart').then(m => m.CartComponent),
    title: 'AbrisTempo Local — Mon panier',
  },
  {
    path: 'panier/caisse',
    canActivate: [authGuard],
    loadComponent: () => import('./features/checkout/checkout').then(m => m.CheckoutComponent),
    title: 'AbrisTempo Local — Caisse',
  },
  // Pages provisoires « en construction » — les fonctionnalités complètes
  // (location saisonnière, réservation d'installation) arrivent plus tard.
  {
    path: 'location',
    loadComponent: () => import('./features/location/location').then(m => m.LocationComponent),
    title: 'Location d’abris — AbrisTempo Local',
  },
  {
    path: 'installation',
    loadComponent: () =>
      import('./features/installation/installation').then(m => m.InstallationComponent),
    title: 'Réservation d’installation — AbrisTempo Local',
  },
  {
    path: 'mesurer',
    loadComponent: () => import('./features/mesurer/mesurer').then(m => m.MesurerComponent),
    title: 'Mesurer mon stationnement — AbrisTempo Local',
  },
  // ── Pages légales (contenu statique, liées depuis le footer et /auth) ──
  {
    path: 'conditions',
    loadComponent: () =>
      import('./features/legal/conditions/conditions').then(m => m.ConditionsComponent),
    title: 'Conditions d’utilisation — AbrisTempo Local',
  },
  {
    path: 'confidentialite',
    loadComponent: () =>
      import('./features/legal/confidentialite/confidentialite').then(
        m => m.ConfidentialiteComponent,
      ),
    title: 'Politique de confidentialité — AbrisTempo Local',
  },
  {
    path: 'accessibilite',
    loadComponent: () =>
      import('./features/legal/accessibilite/accessibilite').then(m => m.AccessibiliteComponent),
    title: 'Déclaration d’accessibilité — AbrisTempo Local',
  },
  // {
  //   path: 'mon-compte',
  //   canActivate: [authGuard],
  //   loadChildren: () => import('./features/account/account.routes').then(m => m.ACCOUNT_ROUTES),
  // },
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    loadChildren: () => import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES),
  },
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
