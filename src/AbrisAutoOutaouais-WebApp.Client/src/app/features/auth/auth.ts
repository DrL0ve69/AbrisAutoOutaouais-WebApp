import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

// ── Validateur cross-field ────────────────────────────────────
function passwordsMatch(ctrl: AbstractControl): ValidationErrors | null {
  const pw = ctrl.get('password')?.value;
  const cpw = ctrl.get('confirmPassword')?.value;
  return pw && cpw && pw !== cpw ? { passwordMismatch: true } : null;
}

// ── Types ─────────────────────────────────────────────────────
type View = 'login' | 'register';
type FlipState = 'idle' | 'out' | 'in';

/** Durée (ms) de chaque demi-animation */
const HALF_FLIP = 320;

@Component({
  selector: 'app-auth',
  templateUrl: './auth.html',
  styleUrl: './auth.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
})
export class AuthComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // ── État ────────────────────────────────────────────────────
  protected readonly view = signal<View>('login');
  protected readonly flipState = signal<FlipState>('idle');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  protected readonly isFlipping = computed(() => this.flipState() !== 'idle');
  protected readonly isLogin = computed(() => this.view() === 'login');

  // ── Formulaire Login ────────────────────────────────────────
  protected readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  // ── Formulaire Register ─────────────────────────────────────
  protected readonly registerForm = this.fb.nonNullable.group(
    {
      firstName: ['', [Validators.required, Validators.maxLength(100)]],
      lastName: ['', [Validators.required, Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/[A-Z]/),      // au moins une majuscule
        Validators.pattern(/[0-9]/),      // au moins un chiffre
        Validators.pattern(/[^a-zA-Z0-9]/), // au moins un caractère spécial
      ]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  // Raccourcis pour les contrôles — évite la répétition dans le template
  protected get lEmail() { return this.loginForm.controls.email; }
  protected get lPassword() { return this.loginForm.controls.password; }

  protected get rFirst() { return this.registerForm.controls.firstName; }
  protected get rLast() { return this.registerForm.controls.lastName; }
  protected get rEmail() { return this.registerForm.controls.email; }
  protected get rPwd() { return this.registerForm.controls.password; }
  protected get rConfirm() { return this.registerForm.controls.confirmPassword; }
  protected get rPwdMismatch() {
    return this.registerForm.hasError('passwordMismatch') &&
      this.rConfirm.touched;
  }

  // ── Animation flip ──────────────────────────────────────────
  protected switchTo(target: View): void {
    if (this.isFlipping() || this.view() === target) return;

    this.error.set(null);
    this.flipState.set('out');

    setTimeout(() => {
      this.view.set(target);
      this.flipState.set('in');
      setTimeout(() => this.flipState.set('idle'), HALF_FLIP);
    }, HALF_FLIP);
  }

  // ── Soumission Login ────────────────────────────────────────
  protected submitLogin(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);

    this.auth.login(this.loginForm.getRawValue()).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: err => {
        // Le backend renvoie { error: "..." } (pas detail)
        this.error.set(
          err.error?.error ?? err.error?.detail ?? 'Identifiants incorrects.',
        );
        this.loading.set(false);
      },
    });
  }

  // ── Soumission Register ─────────────────────────────────────
  protected submitRegister(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);

    const { firstName, lastName, email, password, confirmPassword } =
      this.registerForm.getRawValue();

    this.auth.register({ firstName, lastName, email, password, confirmPassword }).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: err => {
        this.error.set(
          err.error?.error ?? err.error?.detail ?? 'Erreur lors de l\'inscription.',
        );
        this.loading.set(false);
      },
    });
  }
}
