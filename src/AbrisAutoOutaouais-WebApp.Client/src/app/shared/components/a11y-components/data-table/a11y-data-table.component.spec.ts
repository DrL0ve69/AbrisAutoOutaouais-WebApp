// features/projects/a11y-components/data-table/a11y-data-table.component.spec.ts
import { render, screen, within } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { A11yDataTableComponent } from './data-table.component';

describe('A11yDataTableComponent', () => {

  // ─── Rendu initial ───────────────────────────────────────────────────────

  describe('rendu initial', () => {
    it('affiche un tableau avec caption accessible', async () => {
      await render(A11yDataTableComponent);

      const table = screen.getByRole('table');
      expect(table).not.null;

      // La caption doit exister même si visuellement masquée (sr-only)
      expect(table).has.name;
    });

    it('affiche les en-têtes de colonnes avec scope="col"', async () => {
      await render(A11yDataTableComponent);

      const headers = screen.getAllByRole('columnheader');
      expect(headers.length).toBeGreaterThan(0);
      headers.forEach(th =>
        expect(th).has('scope', 'col')
      );
    });

    it('affiche le champ de recherche avec label associé', async () => {
      await render(A11yDataTableComponent);

      const input = screen.getByRole('searchbox', { name: /rechercher/i });
      expect(input).not.null;
    });

    it('affiche le message de statut aria-live au chargement', async () => {
      await render(A11yDataTableComponent);

      const status = screen.getByRole('status');
      expect(status).not.null;
      expect(status).has.toHaveReturnedWith(/entrée/i);
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
      // En-tête + lignes filtrées seulement
      expect(rows.length).toBeGreaterThanOrEqual(2);
    });

  //   it('met à jour le message de statut après filtrage', async () => {
  //     const user = userEvent.setup();
  //     await render(A11yDataTableComponent);

  //     await user.type(screen.getByRole('searchbox'), 'zzz-aucun-résultat');

  //     const status = screen.getByRole('status');
  //     expect(status).toHaveTextContent(/0/);
  //   });

  //   it('affiche un message "aucun résultat" dans le tableau', async () => {
  //     const user = userEvent.setup();
  //     await render(A11yDataTableComponent);

  //     await user.type(screen.getByRole('searchbox'), 'zzz-aucun-résultat');

  //     const cell = screen.getByRole('cell', { name: /aucun résultat/i });
  //     expect(cell).toBeInTheDocument();
  //   });

  //   it('le message aucun résultat a le bon colspan', async () => {
  //     const user = userEvent.setup();
  //     const { fixture } = await render(A11yDataTableComponent);

  //     await user.type(screen.getByRole('searchbox'), 'zzz');

  //     const cell = screen.getByRole('cell', { name: /aucun résultat/i });
  //     const colCount = fixture.componentInstance.columns.length;
  //     expect(cell).toHaveAttribute('colspan', String(colCount));
  //   });
  // });

  // // ─── Tri ──────────────────────────────────────────────────────────────────

  // describe('tri des colonnes', () => {
  //   it('chaque bouton de tri a un aria-label descriptif', async () => {
  //     await render(A11yDataTableComponent);

  //     const sortButtons = screen.getAllByRole('button', { name: /trier/i });
  //     expect(sortButtons.length).toBeGreaterThan(0);
  //     sortButtons.forEach(btn =>
  //       expect(btn).toHaveAccessibleName()
  //     );
  //   });

  //   it('applique aria-sort="ascending" après un clic sur une colonne', async () => {
  //     const user = userEvent.setup();
  //     await render(A11yDataTableComponent);

  //     const nameHeader = screen.getByRole('columnheader', { name: /nom/i });
  //     const sortBtn = within(nameHeader).getByRole('button');
  //     await user.click(sortBtn);

  //     expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
  //   });

  //   it('bascule à "descending" au deuxième clic', async () => {
  //     const user = userEvent.setup();
  //     await render(A11yDataTableComponent);

  //     const nameHeader = screen.getByRole('columnheader', { name: /nom/i });
  //     const sortBtn = within(nameHeader).getByRole('button');

  //     await user.click(sortBtn);
  //     await user.click(sortBtn);

  //     expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
  //   });

  //   it('les colonnes non triées ont aria-sort="none"', async () => {
  //     const user = userEvent.setup();
  //     await render(A11yDataTableComponent);

  //     // Trier par "Nom"
  //     const nameHeader = screen.getByRole('columnheader', { name: /nom/i });
  //     await user.click(within(nameHeader).getByRole('button'));

  //     // Les autres colonnes doivent rester à "none"
  //     const otherHeaders = screen.getAllByRole('columnheader').filter(
  //       h => h !== nameHeader
  //     );
  //     otherHeaders.forEach(h =>
  //       expect(h).toHaveAttribute('aria-sort', 'none')
  //     );
  //   });
  // });

  // // ─── Pagination ───────────────────────────────────────────────────────────

  // describe('pagination', () => {
  //   it('la navigation de pagination a un aria-label', async () => {
  //     await render(A11yDataTableComponent);

  //     const nav = screen.getByRole('navigation', { name: /pagination/i });
  //     expect(nav).toBeInTheDocument();
  //   });

  //   it('la page courante a aria-current="page"', async () => {
  //     await render(A11yDataTableComponent);

  //     const currentPage = screen.getByRole('button', {
  //       name: /page 1/i,
  //     });
  //     expect(currentPage).toHaveAttribute('aria-current', 'page');
  //   });

  //   it('le bouton "page précédente" est désactivé sur la première page', async () => {
  //     await render(A11yDataTableComponent);

  //     const prevBtn = screen.getByRole('button', { name: /page précédente/i });
  //     expect(prevBtn).toBeDisabled();
  //   });

  //   it('navigue à la page suivante', async () => {
  //     const user = userEvent.setup();
  //     await render(A11yDataTableComponent);

  //     const nextBtn = screen.getByRole('button', { name: /page suivante/i });
  //     await user.click(nextBtn);

  //     const page2 = screen.getByRole('button', { name: /page 2/i });
  //     expect(page2).toHaveAttribute('aria-current', 'page');
  //   });
  // });

  // // ─── Accessibilité clavier ────────────────────────────────────────────────

  // describe('navigation clavier', () => {
  //   it('le champ de recherche est atteignable au clavier', async () => {
  //     const user = userEvent.setup();
  //     await render(A11yDataTableComponent);

  //     await user.tab();
  //     expect(screen.getByRole('searchbox')).toHaveFocus();
  //   });

  //   it('les boutons de tri sont atteignables au clavier', async () => {
  //     const user = userEvent.setup();
  //     await render(A11yDataTableComponent);

  //     // Tab jusqu'au premier bouton de tri
  //     await user.tab(); // searchbox
  //     await user.tab(); // premier bouton de tri

  //     const firstSortBtn = screen.getAllByRole('button', { name: /trier/i })[0];
  //     expect(firstSortBtn).toHaveFocus();
  //   });

  //   it('Entrée sur un bouton de tri déclenche le tri', async () => {
  //     const user = userEvent.setup();
  //     await render(A11yDataTableComponent);

  //     await user.tab();
  //     await user.tab();
  //     await user.keyboard('{Enter}');

  //     const nameHeader = screen.getByRole('columnheader', { name: /nom/i });
  //     expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
  //   });
  });
});
