import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

// ── Validateur cross-field (même règle que l'inscription, auth.ts) ──
function passwordsMatch(ctrl: AbstractControl): ValidationErrors | null {
  const pw = ctrl.get('newPassword')?.value;
  const cpw = ctrl.get('confirmPassword')?.value;
  return pw && cpw && pw !== cpw ? { passwordMismatch: true } : null;
}

/**
 * /auth/reset — Réinitialisation du mot de passe, en deux modes :
 *
 * 1. SANS jeton dans l'URL : formulaire « mot de passe oublié » (courriel) →
 *    POST /auth/forgot-password. La confirmation affichée est TOUJOURS la même
 *    (anti-énumération : ne pas révéler l'existence d'un compte).
 * 2. AVEC `?email=…&token=…` (lien reçu par courriel ; liés via
 *    withComponentInputBinding) : formulaire nouveau mot de passe →
 *    POST /auth/reset-password, puis état de succès avec lien vers /auth.
 *
 * Focus (L-006) : la cible de focus (confirmation / titre de succès) n'existe
 * qu'APRÈS le rendu qui suit le changement de signal — on la focalise via un
 * effect() qui lit son viewChild(), rejoué une fois l'élément dans le DOM.
 */
@Component({
  selector: 'app-reset',
  templateUrl: './reset.html',
  styleUrl: './reset.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
})
export class ResetComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  // Paramètres de requête liés par withComponentInputBinding (app.config.ts).
  // ATTENTION : quand le paramètre est ABSENT de l'URL, le routeur lie
  // explicitement `undefined` — la valeur par défaut de input() ne survit pas.
  // Typer optionnel et garder le code défensif (?? '').
  readonly email = input<string | undefined>(undefined);
  readonly token = input<string | undefined>(undefined);

  protected readonly hasToken = computed(() => !!this.token());

  protected readonly loading = signal(false);
  /** Mode demande : confirmation neutre affichée (anti-énumération). */
  protected readonly requestSent = signal(false);
  /** Mode réinitialisation : succès. */
  protected readonly resetDone = signal(false);
  protected readonly error = signal<string | null>(null);

  // ── Formulaire « mot de passe oublié » ──────────────────────
  protected readonly requestForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  // ── Formulaire « nouveau mot de passe » ─────────────────────
  // Parité STRICTE avec la politique serveur : Identity exige minuscule,
  // majuscule, chiffre et caractère spécial (DependencyInjection.cs) et
  // ResetPasswordCommandValidator les rejoue. Une règle manquante ici laisserait
  // passer un mot de passe (ex. tout en MAJUSCULES) que le serveur refuse en 422 —
  // garder les trois validateurs alignés (L-004 : un format partagé = UNE définition).
  protected readonly resetForm = this.fb.nonNullable.group(
    {
      newPassword: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/[A-Z]/),        // au moins une majuscule
        Validators.pattern(/[a-z]/),        // au moins une minuscule
        Validators.pattern(/[0-9]/),        // au moins un chiffre
        Validators.pattern(/[^a-zA-Z0-9]/), // au moins un caractère spécial
      ]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  // Cibles de focus rendues conditionnellement (@if) — voir les effects.
  private readonly requestConfirm =
    viewChild<ElementRef<HTMLElement>>('requestConfirm');
  private readonly successHeading =
    viewChild<ElementRef<HTMLElement>>('successHeading');

  // Bouton de soumission « nouveau mot de passe » : reste dans le DOM en cas
  // d'erreur (le formulaire est réaffiché) → cible de renvoi du focus.
  private readonly resetSubmitBtn =
    viewChild<ElementRef<HTMLElement>>('resetSubmitBtn');

  constructor() {
    // L-006 : focus APRÈS le rendu — chaque effect se rejoue quand son
    // viewChild() trouve l'élément nouvellement rendu (jamais dans le même
    // tick que le signal qui retire le bouton soumis du DOM).
    effect(() => this.requestConfirm()?.nativeElement.focus());
    effect(() => this.successHeading()?.nativeElement.focus());
  }

  protected get reqEmail() {
    return this.requestForm.controls.email;
  }
  protected get newPwd() {
    return this.resetForm.controls.newPassword;
  }
  protected get confirmPwd() {
    return this.resetForm.controls.confirmPassword;
  }
  protected get pwdMismatch() {
    return this.resetForm.hasError('passwordMismatch') && this.confirmPwd.touched;
  }

  // ── Mode demande ────────────────────────────────────────────
  protected submitRequest(): void {
    // Garde de ré-entrée : l'appel est asynchrone et le bouton reste activé
    // (aria-busy plutôt que [disabled], pour ne pas perdre le focus clavier).
    // Sans cette garde, un double-déclenchement (Entrée + clic) enverrait deux
    // requêtes.
    if (this.loading()) return;
    if (this.requestForm.invalid) {
      this.requestForm.markAllAsTouched();
      return;
    }
    this.loading.set(true);

    this.auth.forgotPassword(this.requestForm.getRawValue().email).subscribe({
      next: () => {
        this.loading.set(false);
        this.requestSent.set(true);
      },
      // Confirmation neutre identique même en cas d'échec : la réponse ne doit
      // jamais permettre de déduire l'existence (ou non) d'un compte.
      error: () => {
        this.loading.set(false);
        this.requestSent.set(true);
      },
    });
  }

  // ── Mode réinitialisation ───────────────────────────────────
  protected submitReset(): void {
    // Garde de ré-entrée (cf. submitRequest) : le bouton reste activé.
    if (this.loading()) return;
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);

    const { newPassword, confirmPassword } = this.resetForm.getRawValue();

    this.auth
      .resetPassword({
        email: this.email() ?? '',
        token: this.token() ?? '',
        newPassword,
        confirmPassword,
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.resetDone.set(true);
        },
        error: err => {
          this.loading.set(false);
          // Le backend renvoie { error: "..." } (idiome du contrôleur)
          this.error.set(
            err.error?.error ??
              err.error?.detail ??
              $localize`:@@reset.errorGeneric:Le lien de réinitialisation est invalide ou expiré. Demandez un nouveau lien.`,
          );
          // Le bouton reste dans le DOM et activé (aria-busy, pas [disabled]) :
          // le message role="alert" est annoncé et on garde explicitement le focus
          // sur le bouton pour qu'il ne retombe pas sur <body> (WCAG 2.4.3).
          // setTimeout : APRÈS le rendu qui ré-affiche l'alerte (L-006).
          setTimeout(() => this.resetSubmitBtn()?.nativeElement.focus());
        },
      });
  }
}
