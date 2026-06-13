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
  AsyncValidatorFn,
  ValidationErrors,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable, of, timer } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';

// ── Validateur cross-field ────────────────────────────────────
function passwordsMatch(ctrl: AbstractControl): ValidationErrors | null {
  const pw = ctrl.get('password')?.value;
  const cpw = ctrl.get('confirmPassword')?.value;
  return pw && cpw && pw !== cpw ? { passwordMismatch: true } : null;
}

/** Délai (ms) avant l'appel réseau de vérification de disponibilité (anti-rafale). */
const AVAILABILITY_DEBOUNCE = 400;

/**
 * Construit un validateur ASYNCHRONE debounced qui vérifie la disponibilité d'un
 * identifiant (H5). Il ne s'active QUE si les validateurs synchrones passent
 * déjà (`control.errors === null` à l'entrée) — inutile d'interroger le serveur
 * pour une valeur vide ou mal formée, et on évite d'écraser une erreur de format.
 * Retourne `{ taken: true }` quand l'identifiant est déjà pris ; un échec réseau
 * est silencieux (null) pour ne pas bloquer l'inscription sur un faux négatif.
 *
 * @param check  appel HTTP renvoyant la disponibilité du seul champ passé.
 */
function availabilityValidator(
  check: (value: string) => Observable<boolean | null>,
): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    const value: string = (control.value ?? '').trim();
    // N'interroge pas le serveur si un validateur synchrone a déjà échoué, ou si vide.
    if (!value || control.errors) return of(null);

    // timer() (re)démarre à chaque frappe → debounce ; switchMap annule l'appel
    // précédent encore en vol, donc seule la dernière saisie compte.
    return timer(AVAILABILITY_DEBOUNCE).pipe(
      switchMap(() => check(value)),
      map(available => (available === false ? { taken: true } : null)),
      catchError(() => of(null)),
    );
  };
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
  // « email » accepte aussi bien un courriel qu'un nom d'utilisateur → pas de Validators.email
  protected readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  // ── Formulaire Register ─────────────────────────────────────
  protected readonly registerForm = this.fb.nonNullable.group(
    {
      firstName: ['', [Validators.required, Validators.maxLength(100)]],
      lastName: ['', [Validators.required, Validators.maxLength(100)]],
      email: ['',
        [Validators.required, Validators.email],
        // Vérification asynchrone debounced de la disponibilité du courriel (H5).
        [availabilityValidator(value =>
          this.auth.checkAvailability({ email: value }).pipe(map(r => r.emailAvailable)))],
      ],
      username: ['',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(30),
          Validators.pattern(/^[a-zA-Z0-9._-]+$/),
        ],
        // Vérification asynchrone debounced de la disponibilité du nom d'utilisateur (H5).
        [availabilityValidator(value =>
          this.auth.checkAvailability({ username: value }).pipe(map(r => r.usernameAvailable)))],
      ],
      // Parité STRICTE avec la politique serveur (Identity + RegisterCommand) :
      // minuscule, majuscule, chiffre et caractère spécial. Sans la règle
      // minuscule, un mot de passe tout en MAJUSCULES passait ici puis échouait
      // en 422 côté serveur (L-004 : un format partagé = UNE définition).
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/[A-Z]/),      // au moins une majuscule
        Validators.pattern(/[a-z]/),      // au moins une minuscule
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
  protected get rUsername() { return this.registerForm.controls.username; }
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
      next: () => this.router.navigateByUrl('/mon-compte/profil'),
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

    const { firstName, lastName, email, username, password, confirmPassword } =
      this.registerForm.getRawValue();

    this.auth.register({ firstName, lastName, email, username, password, confirmPassword }).subscribe({
      next: () => this.router.navigateByUrl('/mon-compte/profil'),
      error: err => {
        this.error.set(
          err.error?.error ?? err.error?.detail ?? 'Erreur lors de l\'inscription.',
        );
        this.loading.set(false);
      },
    });
  }
}
