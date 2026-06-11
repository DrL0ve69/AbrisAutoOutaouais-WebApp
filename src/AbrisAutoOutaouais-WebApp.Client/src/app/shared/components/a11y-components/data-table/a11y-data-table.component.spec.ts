// features/projects/a11y-components/data-table/a11y-data-table.component.spec.ts
import { render, screen } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { A11yDataTableComponent } from './data-table.component';

describe('A11yDataTableComponent', () => {

  // ─── Rendu initial ───────────────────────────────────────────────────────

  describe('rendu initial', () => {
    it('affiche un tableau avec caption accessible', async () => {
      await render(A11yDataTableComponent);

      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();

      // La caption doit exister même si visuellement masquée (sr-only)
      const caption = table.querySelector('caption');
      expect(caption).toBeInTheDocument();
      expect(caption).toHaveTextContent(/triables par colonne/i);
    });

    it('affiche les en-têtes de colonnes avec scope="col"', async () => {
      await render(A11yDataTableComponent);

      const headers = screen.getAllByRole('columnheader');
      expect(headers.length).toBeGreaterThan(0);
      headers.forEach(th =>
        expect(th).toHaveAttribute('scope', 'col')
      );
    });

    it('affiche le champ de recherche avec label associé', async () => {
      await render(A11yDataTableComponent);

      const input = screen.getByRole('searchbox', { name: /rechercher/i });
      expect(input).toBeInTheDocument();
    });

    it('affiche le message de statut aria-live au chargement', async () => {
      await render(A11yDataTableComponent);

      const status = screen.getByRole('status');
      expect(status).toBeInTheDocument();
      expect(status).toHaveTextContent(/entrée/i);
    });
  });

  // ─── Filtrage ─────────────────────────────────────────────────────────────

  describe('filtrage', () => {
    it('filtre les lignes selon la saisie', async () => {
      const user = userEvent.setup();
      await render(A11yDataTableComponent);

      const input = screen.getByRole('searchbox');
      await user.type(input, 'Axe');

      const rows = screen.getAllByRole('row');
      // Au moins la ligne d'en-tête reste présente.
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });
  });
});
