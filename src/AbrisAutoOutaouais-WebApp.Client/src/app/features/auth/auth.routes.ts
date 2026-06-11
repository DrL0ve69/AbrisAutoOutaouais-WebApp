import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./auth').then(m => m.AuthComponent),
    title: 'AbrisTempo — Connexion / Inscription',
  },
  // Redirige /auth/login et /auth/register vers /auth (flip géré dans le composant)
  { path: 'login', redirectTo: '', pathMatch: 'full' },
  { path: 'register', redirectTo: '', pathMatch: 'full' },
  { path: '**', redirectTo: '' },
];
