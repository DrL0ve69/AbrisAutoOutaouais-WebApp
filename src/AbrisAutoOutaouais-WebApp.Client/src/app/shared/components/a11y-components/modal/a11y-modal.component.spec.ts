// features/projects/a11y-components/modal/a11y-modal.component.spec.ts
import { render, screen } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { A11yModalComponent } from './a11y-modal.component';

describe('A11yModalComponent', () => {

  // ─── État fermé ───────────────────────────────────────────────────────────

  describe('état initial (fermé)', () => {
    it('le bouton déclencheur est présent et accessible', async () => {
      await render(A11yModalComponent);

      const btn = screen.getByRole('button', { name: /ouvrir/i });
      expect(btn).toBeInTheDocument();
    });

    it('la modale est absente du DOM à l\'état initial', async () => {
      await render(A11yModalComponent);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  // ─── Ouverture ────────────────────────────────────────────────────────────

  describe('ouverture', () => {
    it('la modale s\'ouvre au clic sur le bouton déclencheur', async () => {
      const user = userEvent.setup();
      await render(A11yModalComponent);

      await user.click(screen.getByRole('button', { name: /ouvrir/i }));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    //   it('la modale a aria-modal="true"', async () => {
    //     const user = userEvent.setup();
    //     await render(A11yModalComponent);

    //     await user.click(screen.getByRole('button', { name: /ouvrir/i }));

    //     expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    //   });

    //   it('la modale a un titre accessible via aria-labelledby', async () => {
    //     const user = userEvent.setup();
    //     await render(A11yModalComponent);

    //     await user.click(screen.getByRole('button', { name: /ouvrir/i }));

    //     const dialog = screen.getByRole('dialog');
    //     expect(dialog).toHaveAccessibleName();
    //   });

    //   it('la modale a une description accessible via aria-describedby', async () => {
    //     const user = userEvent.setup();
    //     await render(A11yModalComponent);

    //     await user.click(screen.getByRole('button', { name: /ouvrir/i }));

    //     const dialog = screen.getByRole('dialog');
    //     expect(dialog).toHaveAccessibleDescription();
    //   });

    //   it('le focus se place dans la modale à l\'ouverture', async () => {
    //     const user = userEvent.setup();
    //     await render(A11yModalComponent);

    //     await user.click(screen.getByRole('button', { name: /ouvrir/i }));

    //     const dialog = screen.getByRole('dialog');
    //     const focused = document.activeElement;
    //     expect(dialog.contains(focused)).toBe(true);
    //   });
    // });

    // // ─── Fermeture ────────────────────────────────────────────────────────────

    // describe('fermeture', () => {
    //   it('se ferme au clic sur Annuler', async () => {
    //     const user = userEvent.setup();
    //     await render(A11yModalComponent);

    //     await user.click(screen.getByRole('button', { name: /ouvrir/i }));
    //     await user.click(screen.getByRole('button', { name: /annuler/i }));

    //     expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    //   });

    //   it('se ferme avec la touche Échap', async () => {
    //     const user = userEvent.setup();
    //     await render(A11yModalComponent);

    //     await user.click(screen.getByRole('button', { name: /ouvrir/i }));
    //     await user.keyboard('{Escape}');

    //     expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    //   });

    //   it('retourne le focus sur le bouton déclencheur après fermeture', async () => {
    //     const user = userEvent.setup();
    //     await render(A11yModalComponent);

    //     const trigger = screen.getByRole('button', { name: /ouvrir/i });
    //     await user.click(trigger);
    //     await user.keyboard('{Escape}');

    //     expect(trigger).toHaveFocus();
    //   });
    // });

    // ─── Piège de focus ───────────────────────────────────────────────────────

    describe('piège de focus', () => {
      it('Tab reste dans la modale — cycle forward', async () => {
        const user = userEvent.setup();
        await render(A11yModalComponent);

        await user.click(screen.getByRole('button', { name: /ouvrir/i }));

        const dialog = screen.getByRole('dialog');
        const focusableItems = dialog.querySelectorAll(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const lastItem = focusableItems[focusableItems.length - 1] as HTMLElement;
        lastItem.focus();

        await user.tab();

        // Le focus doit être revenu sur le premier élément focusable
        expect(dialog.contains(document.activeElement)).toBe(true);
      });

      it('Shift+Tab reste dans la modale — cycle backward', async () => {
        const user = userEvent.setup();
        await render(A11yModalComponent);

        await user.click(screen.getByRole('button', { name: /ouvrir/i }));

        const dialog = screen.getByRole('dialog');
        const firstItem = dialog.querySelector(
          'button:not([disabled])'
        ) as HTMLElement;
        firstItem.focus();

        await user.tab({ shift: true });

        expect(dialog.contains(document.activeElement)).toBe(true);
      });
    });
  });
});
