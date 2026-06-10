import {
  Injectable,
  computed,
  inject,
  signal,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly roles: readonly string[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  confirmPassword: string;
}

/**
 * AuthResponse — correspond exactement au sealed record C# :
 * AuthResponse(string Token, DateTime ExpiresAt, Guid UserId,
 *              string Email, string FullName, string[] Roles)
 * sérialisé en camelCase par ASP.NET Core.
 */
export interface AuthResponse {
  token: string;
  expiresAt: string;
  userId: string;
  email: string;
  fullName: string;
  roles: string[];
}

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly platform = inject(PLATFORM_ID);

  // État réactif — privé en écriture, public en lecture
  private readonly _token = signal<string | null>(this.loadRaw(TOKEN_KEY));
  private readonly _user = signal<AuthUser | null>(this.loadUser());

  readonly token = this._token.asReadonly();
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._token() !== null);
  readonly isAdmin = computed(() =>
    this._user()?.roles.includes('Admin') ?? false);
  readonly isStaff = computed(() =>
    this._user()?.roles.some(r => r === 'Staff' || r === 'Admin') ?? false);
  readonly fullName = computed(() => {
    const u = this._user();
    if (!u) return null;
    const name = `${u.firstName} ${u.lastName}`.trim();
    return name || u.email;
  });
  readonly initials = computed(() => {
    const u = this._user();
    if (!u) return '?';
    const f = u.firstName[0] ?? '';
    const l = u.lastName[0] ?? '';
    return (f + l).toUpperCase() || u.email[0].toUpperCase();
  });

  login(req: LoginRequest) {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/login`, req)
      .pipe(tap(res => this.setSession(res)));
  }

  register(req: RegisterRequest) {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/register`, req)
      .pipe(tap(res => this.setSession(res)));
  }

  logout(): void {
    this.clearSession();
    this.router.navigateByUrl('/auth');
  }

  getToken(): string | null {
    return this._token();
  }

  // ── Privé ──────────────────────────────────────────────────

  private setSession(res: AuthResponse): void {
    // Découper fullName en firstName / lastName
    const parts = (res.fullName ?? '').trim().split(/\s+/);
    const firstName = parts[0] ?? '';
    const lastName = parts.slice(1).join(' ');

    const user: AuthUser = {
      id: res.userId,
      email: res.email,
      firstName,
      lastName,
      roles: res.roles,
    };

    this._token.set(res.token);
    this._user.set(user);

    if (isPlatformBrowser(this.platform)) {
      localStorage.setItem(TOKEN_KEY, res.token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  }

  private clearSession(): void {
    this._token.set(null);
    this._user.set(null);

    if (isPlatformBrowser(this.platform)) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  }

  private loadRaw(key: string): string | null {
    if (!isPlatformBrowser(this.platform)) return null;
    return localStorage.getItem(key);
  }

  private loadUser(): AuthUser | null {
    if (!isPlatformBrowser(this.platform)) return null;
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }
}



// import {
//   Injectable, computed, inject, signal, PLATFORM_ID
// } from '@angular/core';
// import { isPlatformBrowser } from '@angular/common';
// import { HttpClient } from '@angular/common/http';
// import { Router } from '@angular/router';
// import { tap } from 'rxjs';
// import { environment } from '../../../environments/environment';

// export interface AuthUser {
//   readonly id: string;
//   readonly email: string;
//   readonly firstName: string;
//   readonly lastName: string;
//   readonly roles: readonly string[];
// }

// export interface LoginRequest { email: string; password: string; }
// export interface RegisterRequest { email: string; firstName: string; lastName: string; password: string; confirmPassword: string; }

// /**
//  * AuthResponse — correspond exactement au sealed record C# :
//  * AuthResponse(string Token, DateTime ExpiresAt, Guid UserId,
//  *              string Email, string FullName, string[] Roles)
//  * sérialisé en camelCase par ASP.NET Core.
//  */
// export interface AuthResponse { token: string; expiresAt: string; userId: string; email: string; fullName: string; roles: string[]; }

// @Injectable({ providedIn: 'root' })
// export class AuthService {
//   private readonly http = inject(HttpClient);
//   private readonly router = inject(Router);
//   private readonly platform = inject(PLATFORM_ID);

//   private readonly _token = signal<string | null>(this.loadFromStorage('auth_token'));
//   private readonly _user = signal<AuthUser | null>(this.loadUserFromStorage());

//   readonly isAuthenticated = computed(() => this._token() !== null);
//   readonly user = this._user.asReadonly();
//   readonly isAdmin = computed(() => this._user()?.roles.includes('Admin') ?? false);
//   readonly isStaff = computed(() => this._user()?.roles.some(r => r === 'Staff' || r === 'Admin') ?? false);
//   readonly fullName = computed(() => {
//     const u = this._user();
//     return u ? `${u.firstName} ${u.lastName}` : null;
//   });

//   login(req: LoginRequest) {
//     return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, req).pipe(
//       tap(res => this.setSession(res))
//     );
//   }

//   register(req: RegisterRequest) {
//     return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/register`, req).pipe(
//       tap(res => this.setSession(res))
//     );
//   }

//   logout(): void {
//     this.clearSession();
//     this.router.navigateByUrl('/auth/login');
//   }

//   getToken(): string | null { return this._token(); }

//   private setSession(res: AuthResponse): void {
//     this._token.set(res.token);
//     this._user.set({ id: res.userId, email: res.email, firstName: '', lastName: '', roles: res.roles });
//     if (isPlatformBrowser(this.platform)) {
//       localStorage.setItem('auth_token', res.token);
//       localStorage.setItem('auth_user', JSON.stringify(res));
//     }
//   }

//   private clearSession(): void {
//     this._token.set(null);
//     this._user.set(null);
//     if (isPlatformBrowser(this.platform)) {
//       localStorage.removeItem('auth_token');
//       localStorage.removeItem('auth_user');
//     }
//   }

//   private loadFromStorage(key: string): string | null {
//     if (!isPlatformBrowser(this.platform)) return null;
//     return localStorage.getItem(key);
//   }

//   private loadUserFromStorage(): AuthUser | null {
//     if (!isPlatformBrowser(this.platform)) return null;
//     try {
//       const raw = localStorage.getItem('auth_user');
//       const res: AuthResponse = raw ? JSON.parse(raw) : null;
//       return res ? { id: res.userId, email: res.email, firstName: '', lastName: '', roles: res.roles } : null;
//     } catch { return null; }
//   }
// }
