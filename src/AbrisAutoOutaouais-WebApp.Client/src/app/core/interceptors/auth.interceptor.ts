import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Auth Interceptor: Attaches JWT token to requests and handles auth errors.
 * - Adds Authorization header with Bearer token for authenticated requests
 * - Catches 401 errors and redirects to login when token is invalid/expired
 */

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();

  // Clone request and set Authorization header if token exists
  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Handle 401 Unauthorized (token expired or invalid)
      if (error.status === 401) {
        // Clear session and redirect to login
        authService.logout();
        router.navigate(['/login'], {
          queryParams: { returnUrl: router.routerState.root },
        });
      }

      // Handle 403 Forbidden (insufficient permissions)
      if (error.status === 403) {
        router.navigate(['/unauthorized']);
      }

      return throwError(() => error);
    }),
  );
};
