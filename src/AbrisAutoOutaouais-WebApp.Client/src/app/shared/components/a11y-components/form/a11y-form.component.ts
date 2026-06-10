import { Component, ChangeDetectionStrategy, signal } from "@angular/core";
import { NonNullableFormBuilder, Validators } from "@angular/forms";
import { inject } from "vitest";

// features/projects/a11y-components/form/a11y-form.component.ts
@Component({
  selector: 'app-a11y-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="form-section-title">
      <h3 id="form-section-title" i18n>Formulaire de contact</h3>

      <!-- Confirmation soumission — role="alert" annonce immédiatement -->
      @if (submitted()) {
        <div role="alert" class="alert--success">
          <p i18n>Message envoyé avec succès. Nous vous répondrons sous 48h.</p>
        </div>
      }

      <form [formGroup]="form"
            (ngSubmit)="onSubmit()"
            novalidate
            aria-labelledby="form-section-title">

        <!-- Nom -->
        <div class="field">
          <label for="contact-name">
            <span i18n>Nom complet</span>
            <abbr title="Champ obligatoire" aria-hidden="true"> *</abbr>
          </label>
          <input id="contact-name"
                 type="text"
                 formControlName="name"
                 autocomplete="name"
                 aria-required="true"
                 [attr.aria-invalid]="isInvalid('name')"
                 [attr.aria-describedby]="isInvalid('name') ? 'name-error' : null" />
          @if (isInvalid('name')) {
            <p id="name-error" class="field__error" role="alert" i18n>
              Le nom complet est requis.
            </p>
          }
        </div>

        <!-- Courriel -->
        <div class="field">
          <label for="contact-email">
            <span i18n>Adresse courriel</span>
            <abbr title="Champ obligatoire" aria-hidden="true"> *</abbr>
          </label>
          <input id="contact-email"
                 type="email"
                 formControlName="email"
                 autocomplete="email"
                 aria-required="true"
                 [attr.aria-invalid]="isInvalid('email')"
                 [attr.aria-describedby]="isInvalid('email') ? 'email-error' : 'email-hint'" />
          <p id="email-hint" class="hint" i18n>
            Format : nom@exemple.com
          </p>
          @if (isInvalid('email')) {
            <p id="email-error" class="field__error" role="alert" i18n>
              Veuillez entrer une adresse courriel valide.
            </p>
          }
        </div>

        <!-- Message -->
        <div class="field">
          <label for="contact-message">
            <span i18n>Message</span>
            <abbr title="Champ obligatoire" aria-hidden="true"> *</abbr>
          </label>
          <textarea id="contact-message"
                    formControlName="message"
                    rows="5"
                    aria-required="true"
                    [attr.aria-invalid]="isInvalid('message')"
                    [attr.aria-describedby]="isInvalid('message')
                      ? 'message-error message-count'
                      : 'message-count'">
          </textarea>
          <p id="message-count"
             class="hint"
             aria-live="polite"
             aria-atomic="true">
            {{ form.get('message')?.value?.length ?? 0 }} / 500 caractères
          </p>
          @if (isInvalid('message')) {
            <p id="message-error" class="field__error" role="alert" i18n>
              Le message est requis (10 caractères minimum).
            </p>
          }
        </div>

        <button type="submit"
                [disabled]="loading()"
                [attr.aria-busy]="loading()">
          @if (loading()) {
            <span aria-hidden="true">⏳</span>
            <span i18n>Envoi en cours…</span>
          } @else {
            <span i18n>Envoyer le message</span>
          }
        </button>

      </form>
    </section>
  `
})
export class A11yFormComponent {
  // readonly fb = inject(NonNullableFormBuilder);

  // readonly form = this.fb.group({
  //   name: ['', [Validators.required, Validators.minLength(2)]],
  //   email: ['', [Validators.required, Validators.email]],
  //   message: ['', [Validators.required, Validators.minLength(10),
  //   Validators.maxLength(500)]],
  // });

  // readonly submitted = signal(false);
  // readonly loading = signal(false);

  // isInvalid(field: string): boolean {
  //   const ctrl = this.form.get(field);
  //   return !!(ctrl?.invalid && ctrl.touched);
  // }

  // onSubmit(): void {
  //   if (this.form.invalid) {
  //     // Marquer tous les champs comme touchés pour afficher les erreurs
  //     this.form.markAllAsTouched();
  //     // Déplacer le focus sur le premier champ en erreur
  //     const firstError = document.querySelector('[aria-invalid="true"]') as HTMLElement;
  //     firstError?.focus();
  //     return;
  //   }
  //   this.loading.set(true);
  //   // Simuler l'appel API
  //   setTimeout(() => {
  //     this.loading.set(false);
  //     this.submitted.set(true);
  //     this.form.reset();
  //   }, 1200);
  // }
}
