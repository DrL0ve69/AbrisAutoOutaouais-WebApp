import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

// Custom validator for password confirmation
function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  
  return password && confirmPassword && password !== confirmPassword
    ? { passwordMismatch: true }
    : null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="register-container">
      <div class="register-card">
        <h1>S'inscrire</h1>
        
        <div *ngIf="error()" class="error-message">
          {{ error() }}
        </div>

        <form [formGroup]="registerForm" (ngSubmit)="onSubmit()" class="register-form">
          <div class="form-row">
            <div class="form-group">
              <label for="firstName">Prénom</label>
              <input
                id="firstName"
                type="text"
                formControlName="firstName"
                class="form-control"
                placeholder="Votre prénom"
                [disabled]="isLoading()"
              />
              <div *ngIf="firstName.invalid && firstName.touched" class="error-text">
                Le prénom est requis
              </div>
            </div>

            <div class="form-group">
              <label for="lastName">Nom</label>
              <input
                id="lastName"
                type="text"
                formControlName="lastName"
                class="form-control"
                placeholder="Votre nom"
                [disabled]="isLoading()"
              />
              <div *ngIf="lastName.invalid && lastName.touched" class="error-text">
                Le nom est requis
              </div>
            </div>
          </div>

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
              placeholder="Minimum 8 caractères"
              [disabled]="isLoading()"
            />
            <div *ngIf="password.invalid && password.touched" class="error-text">
              Le mot de passe doit contenir au minimum 8 caractères
            </div>
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirmer le mot de passe</label>
            <input
              id="confirmPassword"
              type="password"
              formControlName="confirmPassword"
              class="form-control"
              placeholder="Confirmer le mot de passe"
              [disabled]="isLoading()"
            />
            <div *ngIf="confirmPassword.invalid && confirmPassword.touched" class="error-text">
              Les mots de passe ne correspondent pas
            </div>
          </div>

          <button
            type="submit"
            class="submit-button"
            [disabled]="registerForm.invalid || isLoading()"
          >
            {{ isLoading() ? 'Inscription en cours...' : "S'inscrire" }}
          </button>
        </form>

        <div class="login-link">
          Déjà inscrit?
          <a routerLink="/login">Se connecter</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .register-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      padding: 20px;
    }

    .register-card {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      width: 100%;
      max-width: 500px;
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

    .register-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
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
      margin-top: 10px;
    }

    .submit-button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
    }

    .submit-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .login-link {
      text-align: center;
      margin-top: 20px;
      color: #666;
    }

    .login-link a {
      color: #667eea;
      text-decoration: none;
      font-weight: 600;
    }

    .login-link a:hover {
      text-decoration: underline;
    }

    @media (max-width: 600px) {
      .form-row {
        grid-template-columns: 1fr;
      }

      .register-card {
        padding: 20px;
      }
    }
  `]
})
export class RegisterComponent {
  registerForm: FormGroup;
  isLoading = signal(false);
  error = signal('');

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.registerForm = this.fb.group(
      {
        firstName: ['', [Validators.required]],
        lastName: ['', [Validators.required]],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: passwordMatchValidator }
    );
  }

  get firstName() {
    return this.registerForm.get('firstName')!;
  }

  get lastName() {
    return this.registerForm.get('lastName')!;
  }

  get email() {
    return this.registerForm.get('email')!;
  }

  get password() {
    return this.registerForm.get('password')!;
  }

  get confirmPassword() {
    return this.registerForm.get('confirmPassword')!;
  }

  onSubmit() {
    if (this.registerForm.invalid) return;

    this.isLoading.set(true);
    this.error.set('');

    this.authService.register(this.registerForm.value).subscribe({
      next: () => {
        this.router.navigate(['/home']);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(err.error?.error || "Erreur lors de l'inscription");
      },
    });
  }
}
