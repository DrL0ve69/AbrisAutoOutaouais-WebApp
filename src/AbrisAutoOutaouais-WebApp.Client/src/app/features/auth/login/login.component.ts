import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="login-container">
      <div class="login-card">
        <h1>Connexion</h1>
        
        <div *ngIf="error()" class="error-message">
          {{ error() }}
        </div>

        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="login-form">
          <div class="form-group">
            <label for="email">Email</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              class="form-control"
              placeholder="votre@email.com"
              [disabled]="isLoading()"
            />
            <div *ngIf="email.invalid && email.touched" class="error-text">
              Email invalide
            </div>
          </div>

          <div class="form-group">
            <label for="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              class="form-control"
              placeholder="••••••••"
              [disabled]="isLoading()"
            />
            <div *ngIf="password.invalid && password.touched" class="error-text">
              Le mot de passe est requis
            </div>
          </div>

          <button
            type="submit"
            class="submit-button"
            [disabled]="loginForm.invalid || isLoading()"
          >
            {{ isLoading() ? 'Connexion en cours...' : 'Se connecter' }}
          </button>
        </form>

        <div class="register-link">
          Pas encore de compte?
          <a routerLink="/register">S'inscrire</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    .login-card {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      width: 100%;
      max-width: 400px;
    }

    h1 {
      text-align: center;
      margin-bottom: 30px;
      color: #333;
      font-size: 28px;
    }

    .error-message {
      background-color: #f8d7da;
      color: #721c24;
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 20px;
      border: 1px solid #f5c6cb;
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
    }

    label {
      margin-bottom: 6px;
      font-weight: 500;
      color: #333;
    }

    .form-control {
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      transition: border-color 0.3s;
    }

    .form-control:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .form-control:disabled {
      background-color: #f5f5f5;
      cursor: not-allowed;
    }

    .error-text {
      color: #dc3545;
      font-size: 12px;
      margin-top: 4px;
    }

    .submit-button {
      padding: 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .submit-button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
    }

    .submit-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .register-link {
      text-align: center;
      margin-top: 20px;
      color: #666;
    }

    .register-link a {
      color: #667eea;
      text-decoration: none;
      font-weight: 600;
    }

    .register-link a:hover {
      text-decoration: underline;
    }
  `]
})
export class LoginComponent {
  loginForm: FormGroup;
  isLoading = signal(false);
  error = signal('');

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  get email() {
    return this.loginForm.get('email')!;
  }

  get password() {
    return this.loginForm.get('password')!;
  }

  onSubmit() {
    if (this.loginForm.invalid) return;

    this.isLoading.set(true);
    this.error.set('');

    this.authService.login(this.loginForm.value).subscribe({
      next: () => {
        this.router.navigate(['/home']);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(err.error?.error || 'Erreur de connexion');
      },
    });
  }
}
