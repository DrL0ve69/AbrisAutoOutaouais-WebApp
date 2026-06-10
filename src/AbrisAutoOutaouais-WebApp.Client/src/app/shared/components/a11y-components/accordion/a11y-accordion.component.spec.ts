// features/projects/a11y-components/accordion/a11y-accordion.component.spec.ts
import { render, screen, within } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { A11yAccordionComponent } from './a11y-accordion.component';

describe('A11yAccordionComponent', () => {

  // describe('structure', () => {
  //   it('les boutons ont aria-expanded="false" au chargement', async () => {
  //     await render(A11yAccordionComponent);

  //     const buttons = screen.getAllByRole('button', { name: /.+\?/i });
  //     buttons.forEach(btn =>
  //       expect(btn).toHaveAttribute('aria-expanded', 'false')
  //     );
  //   });

  //   it('les panneaux sont masqués au chargement', async () => {
  //     await render(A11yAccordionComponent);

  //     const panels = screen.getAllByRole('region', { hidden: true });
  //     panels.forEach(panel => expect(panel).not.toBeVisible());
  //   });

  //   it('chaque panneau est lié à son bouton via aria-labelledby', async () => {
  //     await render(A11yAccordionComponent);

  //     const panels = document.querySelectorAll('[role="region"]');
  //     panels.forEach(panel => {
  //       const labelId = panel.getAttribute('aria-labelledby');
  //       expect(labelId).toBeTruthy();
  //       expect(document.getElementById(labelId!)).toBeInTheDocument();
  //     });
  //   });
  // });

  // describe('interaction', () => {
  //   it('s\'ouvre au clic et passe aria-expanded à true', async () => {
  //     const user = userEvent.setup();
  //     await render(A11yAccordionComponent);

  //     const firstBtn = screen.getAllByRole('button', { name: /.+\?/i })[0];
  //     await user.click(firstBtn);

  //     expect(firstBtn).toHaveAttribute('aria-expanded', 'true');
  //   });

  //   it('le panneau est visible après ouverture', async () => {
  //     const user = userEvent.setup();
  //     await render(A11yAccordionComponent);

  //     const firstBtn = screen.getAllByRole('button', { name: /.+\?/i })[0];
  //     await user.click(firstBtn);

  //     const panelId = firstBtn.getAttribute('aria-controls')!;
  //     const panel = document.getElementById(panelId);
  //     expect(panel).toBeVisible();
  //   });

  //   it('se ferme au deuxième clic', async () => {
  //     const user = userEvent.setup();
  //     await render(A11yAccordionComponent);

  //     const firstBtn = screen.getAllByRole('button', { name: /.+\?/i })[0];
  //     await user.click(firstBtn);
  //     await user.click(firstBtn);

  //     expect(firstBtn).toHaveAttribute('aria-expanded', 'false');
  //   });

  //   it('"Tout ouvrir" expand tous les panneaux', async () => {
  //     const user = userEvent.setup();
  //     await render(A11yAccordionComponent);

  //     await user.click(screen.getByRole('button', { name: /tout ouvrir/i }));

  //     const accordionBtns = screen.getAllByRole('button', { name: /.+\?/i });
  //     accordionBtns.forEach(btn =>
  //       expect(btn).toHaveAttribute('aria-expanded', 'true')
  //     );
  //   });

  //   it('"Tout fermer" réduit tous les panneaux', async () => {
  //     const user = userEvent.setup();
  //     await render(A11yAccordionComponent);

  //     await user.click(screen.getByRole('button', { name: /tout ouvrir/i }));
  //     await user.click(screen.getByRole('button', { name: /tout fermer/i }));

  //     const accordionBtns = screen.getAllByRole('button', { name: /.+\?/i });
  //     accordionBtns.forEach(btn =>
  //       expect(btn).toHaveAttribute('aria-expanded', 'false')
  //     );
  //   });
  // });

  // describe('navigation clavier', () => {
  //   it('Flèche bas déplace le focus au bouton suivant', async () => {
  //     const user = userEvent.setup();
  //     await render(A11yAccordionComponent);

  //     const buttons = screen.getAllByRole('button', { name: /.+\?/i });
  //     buttons[0].focus();
  //     await user.keyboard('{ArrowDown}');

  //     expect(buttons[1]).toHaveFocus();
  //   });

  //   it('Flèche haut déplace le focus au bouton précédent', async () => {
  //     const user = userEvent.setup();
  //     await render(A11yAccordionComponent);

  //     const buttons = screen.getAllByRole('button', { name: /.+\?/i });
  //     buttons[1].focus();
  //     await user.keyboard('{ArrowUp}');

  //     expect(buttons[0]).toHaveFocus();
  //   });

  //   it('Flèche bas sur le dernier revient au premier (cycle)', async () => {
  //     const user = userEvent.setup();
  //     await render(A11yAccordionComponent);

  //     const buttons = screen.getAllByRole('button', { name: /.+\?/i });
  //     buttons[buttons.length - 1].focus();
  //     await user.keyboard('{ArrowDown}');

  //     expect(buttons[0]).toHaveFocus();
  //   });

  //   it('Home déplace le focus sur le premier bouton', async () => {
  //     const user = userEvent.setup();
  //     await render(A11yAccordionComponent);

  //     const buttons = screen.getAllByRole('button', { name: /.+\?/i });
  //     buttons[2].focus();
  //     await user.keyboard('{Home}');

  //     expect(buttons[0]).toHaveFocus();
  //   });

  //   it('End déplace le focus sur le dernier bouton', async () => {
  //     const user = userEvent.setup();
  //     await render(A11yAccordionComponent);

  //     const buttons = screen.getAllByRole('button', { name: /.+\?/i });
  //     buttons[0].focus();
  //     await user.keyboard('{End}');

  //     expect(buttons[buttons.length - 1]).toHaveFocus();
  //   });
  // });
});
