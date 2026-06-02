import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

export interface AuthResponse {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  token: string;
  roles: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = 'http://localhost:5000/api/v1';
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'current_user';

  public authUser = signal<AuthResponse | null>(this.getStoredUser());
  public isAuthenticated = signal(!!this.getStoredToken());

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    // Restore auth state on service initialization
    this.restoreAuthState();
  }

  /**
   * Register a new user
   */
  register(request: RegisterRequest) {
    return this.http.post<AuthResponse>(
      `${this.API_URL}/auth/register`,
      request
    ).pipe(
      tap(response => this.setAuthState(response)),
      catchError(error => {
        console.error('Registration error:', error);
        throw error;
      })
    );
  }

  /**
   * Login user
   */
  login(request: LoginRequest) {
    return this.http.post<AuthResponse>(
      `${this.API_URL}/auth/login`,
      request
    ).pipe(
      tap(response => this.setAuthState(response)),
      catchError(error => {
        console.error('Login error:', error);
        throw error;
      })
    );
  }

  /**
   * Logout user
   */
  logout() {
    this.clearAuthState();
    this.router.navigate(['/login']);
  }

  /**
   * Check if user is in a specific role
   */
  isInRole(role: string): boolean {
    const user = this.authUser();
    return user ? user.roles.includes(role) : false;
  }

  /**
   * Get stored JWT token
   */
  getToken(): string | null {
    return this.getStoredToken();
  }

  /**
   * Private methods
   */
  private setAuthState(response: AuthResponse) {
    localStorage.setItem(this.TOKEN_KEY, response.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(response));
    this.authUser.set(response);
    this.isAuthenticated.set(true);
  }

  private clearAuthState() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.authUser.set(null);
    this.isAuthenticated.set(false);
  }

  private getStoredToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  private getStoredUser(): AuthResponse | null {
    const user = localStorage.getItem(this.USER_KEY);
    return user ? JSON.parse(user) : null;
  }

  private restoreAuthState() {
    const token = this.getStoredToken();
    const user = this.getStoredUser();
    if (token && user) {
      this.authUser.set(user);
      this.isAuthenticated.set(true);
    }
  }
}
