import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

/**
 * /auth/reset — Demande de réinitialisation du mot de passe.
 *
 * Aucune dépendance backend n'est requise : pour des raisons de sécurité
 * (ne pas révéler l'existence d'un compte), la page affiche toujours la même
 * confirmation générique après soumission. Lorsqu'un point de terminaison
 * « forgot-password » sera disponible, brancher l'appel dans `submit()`.
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

  protected readonly submitted = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected get email() {
    return this.form.controls.email;
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    // Confirmation neutre — identique que le compte existe ou non (anti-énumération).
    this.submitted.set(true);
  }
}
