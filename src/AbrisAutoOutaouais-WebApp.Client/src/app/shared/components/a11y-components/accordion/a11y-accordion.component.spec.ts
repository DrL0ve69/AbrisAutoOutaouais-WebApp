// features/projects/a11y-components/accordion/a11y-accordion.component.spec.ts
import { render, screen } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { A11yAccordionComponent } from './a11y-accordion.component';

describe('A11yAccordionComponent', () => {

  describe('structure', () => {
    it('les en-têtes sont des boutons avec aria-expanded="false" au chargement', async () => {
      await render(A11yAccordionComponent);

      const buttons = screen.getAllByRole('button', { name: /.+\?/i });
      expect(buttons.length).toBeGreaterThan(0);
      buttons.forEach(btn =>
        expect(btn).toHaveAttribute('aria-expanded', 'false')
      );
    });
  });

  describe('interaction', () => {
    it('s\'ouvre au clic et passe aria-expanded à true', async () => {
      const user = userEvent.setup();
      await render(A11yAccordionComponent);

      const firstBtn = screen.getAllByRole('button', { name: /.+\?/i })[0];
      expect(firstBtn).toHaveAttribute('aria-expanded', 'false');

      await user.click(firstBtn);
      expect(firstBtn).toHaveAttribute('aria-expanded', 'true');

      // Le panneau associé devient visible.
      const panelId = firstBtn.getAttribute('aria-controls')!;
      const panel = document.getElementById(panelId);
      expect(panel).toBeVisible();
    });

    it('se ferme au deuxième clic', async () => {
      const user = userEvent.setup();
      await render(A11yAccordionComponent);

      const firstBtn = screen.getAllByRole('button', { name: /.+\?/i })[0];
      await user.click(firstBtn);
      await user.click(firstBtn);

      expect(firstBtn).toHaveAttribute('aria-expanded', 'false');
    });

    it('"Tout ouvrir" déploie tous les panneaux', async () => {
      const user = userEvent.setup();
      await render(A11yAccordionComponent);

      await user.click(screen.getByRole('button', { name: /tout ouvrir/i }));

      const accordionBtns = screen.getAllByRole('button', { name: /.+\?/i });
      accordionBtns.forEach(btn =>
        expect(btn).toHaveAttribute('aria-expanded', 'true')
      );
    });
  });
});
