import { render, screen } from '@testing-library/angular';
import { describe, it, expect } from 'vitest';
import { ConditionsComponent } from './conditions';
import { expectNoA11yViolations } from '../../../../testing/axe-helper';

describe('ConditionsComponent', () => {
  it('affiche le h1 « Conditions d’utilisation » et une hiérarchie de sections', async () => {
    await render(ConditionsComponent);

    expect(
      screen.getByRole('heading', { level: 1, name: /conditions d'utilisation/i }),
    ).toBeInTheDocument();
    // Les sections du document sont des h2 (hiérarchie h1 → h2 sans saut).
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(3);
  });

  it('ne présente aucune violation WCAG A/AA (axe)', async () => {
    const { container } = await render(ConditionsComponent);
    await expectNoA11yViolations(container);
  });
});
