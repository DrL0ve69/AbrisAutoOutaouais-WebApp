import { Component } from '@angular/core';
import { render, within } from '@testing-library/angular';
import { describe, it, expect } from 'vitest';
import { MagneticHoverDirective } from './magnetic-hover';
import { expectNoA11yViolations } from '../../../testing/axe-helper';

@Component({
  imports: [MagneticHoverDirective],
  template: `<button type="button" appMagneticHover data-testid="cta">Réserver une installation</button>`,
})
class HostComponent {}

async function setup() {
  const rendered = await render(HostComponent);
  const q = within(rendered.container as HTMLElement);
  return { ...rendered, q };
}

describe('MagneticHoverDirective', () => {
  it("reste focusable et cliquable (l'effet ne touche pas l'interactivité)", async () => {
    const { q } = await setup();
    const btn = q.getByTestId('cta') as HTMLButtonElement;
    // Au focus clavier, l'élément ne doit pas être déplacé (transform seulement au survol pointeur).
    btn.focus();
    expect(document.activeElement).toBe(btn);
    expect(btn.style.transform).toBe('');
    // Reste un bouton natif accessible (nom + rôle).
    expect(q.getByRole('button', { name: /réserver une installation/i })).toBeTruthy();
  });

  it('ne présente aucune violation WCAG A/AA (axe)', async () => {
    const { container } = await setup();
    await expectNoA11yViolations(container);
  });
});
