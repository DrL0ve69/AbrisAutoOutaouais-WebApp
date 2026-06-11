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

      expect(screen.getByLabelText(/nom complet/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/adresse courriel/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
    });

    it('le compteur de caractères est dans le DOM', async () => {
      await render(A11yFormComponent, {
        imports: [ReactiveFormsModule],
      });

      expect(screen.getByText(/0 \/ 1000/i)).toBeInTheDocument();
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

      // Les messages apparaissent à la fois sous le champ et dans le résumé.
      expect(screen.getAllByText(/nom complet est requis/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/courriel.*requis/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/message est requis/i).length).toBeGreaterThan(0);
    });

    it('affiche le résumé des erreurs avec role="alert"', async () => {
      const user = userEvent.setup();
      await render(A11yFormComponent, {
        imports: [ReactiveFormsModule],
      });

      await user.click(screen.getByRole('button', { name: /envoyer/i }));

      const summary = await screen.findByRole('alert');
      expect(summary).toBeInTheDocument();
      expect(summary).toHaveTextContent(/corriger les erreurs/i);
    });

    it('les liens du résumé pointent vers les bons champs', async () => {
      const user = userEvent.setup();
      await render(A11yFormComponent, {
        imports: [ReactiveFormsModule],
      });

      await user.click(screen.getByRole('button', { name: /envoyer/i }));

      const links = await screen.findAllByRole('link');
      const hrefs = links.map(l => l.getAttribute('href'));

      expect(hrefs).toContain('#contact-name');
      expect(hrefs).toContain('#contact-email');
      expect(hrefs).toContain('#contact-message');
    });
  });
});
