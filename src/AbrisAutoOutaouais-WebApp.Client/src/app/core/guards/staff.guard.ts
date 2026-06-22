import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Garde la vue planning (US-11.1) : accessible au personnel (Staff OU Admin).
 * Miroir d'adminGuard, mais via `auth.isStaff()` (qui inclut déjà Admin) pour ne PAS
 * fermer la route au rôle Staff. Refus → redirection vers l'accueil.
 */
export const staffGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isStaff() ? true : router.createUrlTree(['/']);
};
