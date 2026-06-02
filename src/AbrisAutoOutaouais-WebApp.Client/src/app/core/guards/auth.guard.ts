import { Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    if (this.authService.isAuthenticated()) {
      // Check if route requires specific roles
      const requiredRoles = route.data['roles'] as string[] | undefined;
      if (requiredRoles && requiredRoles.length > 0) {
        const hasRole = requiredRoles.some(role =>
          this.authService.isInRole(role)
        );
        if (!hasRole) {
          this.router.navigate(['/unauthorized']);
          return false;
        }
      }
      return true;
    }

    this.router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }
}
