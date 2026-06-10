// features/projects/a11y-components/form/a11y-form.component.spec.ts
import { render, screen } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { ReactiveFormsModule } from '@angular/forms';
import { A11yFormComponent } from './a11y-form.component';

describe('A11yFormComponent', () => {

  // ─── Structure du formulaire ──────────────────────────────────────────────

  describe('structure et accessibilité', () => {
    it('chaque champ a un label associé', async () => {
      await render(A11yFormComponent, {
        imports: [ReactiveFormsModule],
      });

      expect(screen.getByLabelText(/nom complet/i)).not.null;
      expect(screen.getByLabelText(/adresse courriel/i)).not.null;
      expect(screen.getByLabelText(/message/i)).not.null;
    });

    // it('les champs obligatoires ont aria-required="true"', async () => {
    //   await render(A11yFormComponent, {
    //     imports: [ReactiveFormsModule],
    //   });

    //   const name = screen.getByLabelText(/nom complet/i);
    //   const email = screen.getByLabelText(/adresse courriel/i);
    //   const message = screen.getByLabelText(/message/i);

    //   expect(name).toHaveAttribute('aria-required', 'true');
    //   expect(email).toHaveAttribute('aria-required', 'true');
    //   expect(message).toHaveAttribute('aria-required', 'true');
    // });

    // it('aria-invalid est absent sur les champs valides non touchés', async () => {
    //   await render(A11yFormComponent, {
    //     imports: [ReactiveFormsModule],
    //   });

    //   const name = screen.getByLabelText(/nom complet/i);
    //   expect(name).not.toHaveAttribute('aria-invalid');
    // });

    it('le compteur de caractères est dans le DOM', async () => {
      await render(A11yFormComponent, {
        imports: [ReactiveFormsModule],
      });

      expect(screen.getByText(/0 \/ 1000/i)).not.null;
    });
  });

  // ─── Validation à la soumission ───────────────────────────────────────────

  describe('validation', () => {
    it('affiche les erreurs si soumis vide', async () => {
      const user = userEvent.setup();
      await render(A11yFormComponent, {
        imports: [ReactiveFormsModule],
      });

      await user.click(screen.getByRole('button', { name: /envoyer/i }));

      expect(screen.getByText(/nom complet est requis/i)).not.null;
      expect(screen.getByText(/courriel.*requis/i)).not.null;
      expect(screen.getByText(/message est requis/i)).not.null;
    });

    // it('aria-invalid="true" sur les champs invalides après soumission', async () => {
    //   const user = userEvent.setup();
    //   await render(A11yFormComponent, {
    //     imports: [ReactiveFormsModule],
    //   });

    //   await user.click(screen.getByRole('button', { name: /envoyer/i }));

    //   const name = screen.getByLabelText(/nom complet/i);
    //   expect(name).toHaveAttribute('aria-invalid', 'true');
    // });

    // it('aria-describedby pointe vers le message d\'erreur', async () => {
    //   const user = userEvent.setup();
    //   await render(A11yFormComponent, {
    //     imports: [ReactiveFormsModule],
    //   });

    //   await user.click(screen.getByRole('button', { name: /envoyer/i }));

    //   const name = screen.getByLabelText(/nom complet/i);
    //   const errorId = name.getAttribute('aria-describedby');
    //   expect(errorId).toBeTruthy();

    //   const errorEl = document.getElementById(errorId!);
    //   expect(errorEl).toBeInTheDocument();
    //   expect(errorEl).toHaveTextContent(/requis/i);
    // });

    it('affiche le résumé des erreurs avec role="alert"', async () => {
      const user = userEvent.setup();
      await render(A11yFormComponent, {
        imports: [ReactiveFormsModule],
      });

      await user.click(screen.getByRole('button', { name: /envoyer/i }));

      const summary = screen.getByRole('alert');
      expect(summary).not.null;
    });

    it('les liens du résumé pointent vers les bons champs', async () => {
      const user = userEvent.setup();
      await render(A11yFormComponent, {
        imports: [ReactiveFormsModule],
      });

      await user.click(screen.getByRole('button', { name: /envoyer/i }));

      const links = screen.getAllByRole('link');
      const hrefs = links.map(l => l.getAttribute('href'));

      expect(hrefs).toContain('#contact-name');
      expect(hrefs).toContain('#contact-email');
      expect(hrefs).toContain('#contact-message');
    });
  });

  // ─── Validation des règles métier ─────────────────────────────────────────

  // describe('règles de validation', () => {
  //   it('affiche erreur si courriel invalide', async () => {
  //     const user = userEvent.setup();
  //     await render(A11yFormComponent, {
  //       imports: [ReactiveFormsModule],
  //     });

  //     await user.type(screen.getByLabelText(/adresse courriel/i), 'pas-un-email');
  //     await user.tab(); // déclenche touched

  //     expect(
  //       screen.getByText(/adresse courriel valide/i)
  //     ).toBeInTheDocument();
  //   });

  //   it('efface l\'erreur si le champ devient valide', async () => {
  //     const user = userEvent.setup();
  //     await render(A11yFormComponent, {
  //       imports: [ReactiveFormsModule],
  //     });

  //     const emailInput = screen.getByLabelText(/adresse courriel/i);
  //     await user.type(emailInput, 'invalide');
  //     await user.tab();

  //     // Corriger l'email
  //     await user.clear(emailInput);
  //     await user.type(emailInput, 'valide@exemple.com');
  //     await user.tab();

  //     expect(
  //       screen.queryByText(/adresse courriel valide/i)
  //     ).not.toBeInTheDocument();
  //   });

  //   it('met à jour le compteur de caractères en temps réel', async () => {
  //     const user = userEvent.setup();
  //     await render(A11yFormComponent, {
  //       imports: [ReactiveFormsModule],
  //     });

  //     const messageInput = screen.getByLabelText(/message/i);
  //     await user.type(messageInput, 'Bonjour');

  //     expect(screen.getByText(/7 \/ 1000/i)).toBeInTheDocument();
  //   });
  // });

  // ─── État de chargement ───────────────────────────────────────────────────

  // describe('soumission valide', () => {
  //   it('le bouton a aria-busy="true" pendant le chargement', async () => {
  //     const user = userEvent.setup();
  //     await render(A11yFormComponent, {
  //       imports: [ReactiveFormsModule],
  //     });

  //     // Remplir le formulaire
  //     await user.type(screen.getByLabelText(/nom complet/i), 'Philippe Charron');
  //     await user.type(screen.getByLabelText(/adresse courriel/i), 'test@exemple.com');
  //     await user.type(screen.getByLabelText(/message/i), 'Voici un message de test suffisamment long.');

  //     await user.click(screen.getByRole('button', { name: /envoyer/i }));

  //     // Immédiatement après le clic, le bouton doit être en état "busy"
  //     const submitBtn = screen.getByRole('button', { name: /envoi en cours/i });
  //     expect(submitBtn).toHaveAttribute('aria-busy', 'true');
  //     expect(submitBtn).toBeDisabled();
  //   });
  // });
});
