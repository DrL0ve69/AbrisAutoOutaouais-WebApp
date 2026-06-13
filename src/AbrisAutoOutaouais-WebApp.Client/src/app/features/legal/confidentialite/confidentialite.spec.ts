import { render, screen } from '@testing-library/angular';
import { describe, it, expect } from 'vitest';
import { ConfidentialiteComponent } from './confidentialite';
import { expectNoA11yViolations } from '../../../../testing/axe-helper';

describe('ConfidentialiteComponent', () => {
  it('affiche le h1 « Politique de confidentialité » et la section Loi 25', async () => {
    await render(ConfidentialiteComponent);

    expect(
      screen.getByRole('heading', { level: 1, name: /politique de confidentialité/i }),
    ).toBeInTheDocument();
    // Les droits Loi 25 (Québec) doivent être documentés.
    expect(screen.getByRole('heading', { level: 2, name: /loi 25/i })).toBeInTheDocument();
  });

  it('ne présente aucune violation WCAG A/AA (axe)', async () => {
    const { container } = await render(ConfidentialiteComponent);
    await expectNoA11yViolations(container);
  });
});
