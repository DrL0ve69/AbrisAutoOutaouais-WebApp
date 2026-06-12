import { render, screen } from '@testing-library/angular';
import { describe, it, expect } from 'vitest';
import { AccessibiliteComponent } from './accessibilite';
import { expectNoA11yViolations } from '../../../../testing/axe-helper';

describe('AccessibiliteComponent', () => {
  it('affiche le h1 « Déclaration d’accessibilité » et la cible WCAG 2.2 AA', async () => {
    await render(AccessibiliteComponent);

    expect(
      screen.getByRole('heading', { level: 1, name: /déclaration d'accessibilité/i }),
    ).toBeInTheDocument();
    // La cible de conformité WCAG 2.2 AA doit être annoncée.
    expect(screen.getByText(/WCAG 2\.2, niveau AA/i)).toBeInTheDocument();
  });

  it('ne présente aucune violation WCAG A/AA (axe)', async () => {
    const { container } = await render(AccessibiliteComponent);
    await expectNoA11yViolations(container);
  });
});
