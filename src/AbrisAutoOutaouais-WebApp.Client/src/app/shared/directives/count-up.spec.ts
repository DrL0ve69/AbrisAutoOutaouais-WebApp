import { Component } from '@angular/core';
import { render, within } from '@testing-library/angular';
import { describe, it, expect, vi } from 'vitest';
import { CountUpDirective } from './count-up';
import { expectNoA11yViolations } from '../../../testing/axe-helper';

@Component({
  imports: [CountUpDirective],
  template: `<p>
    <span appCountUp [countTo]="500" countSuffix="+" data-testid="compteur">500+</span>
    abris installés
  </p>`,
})
class HostComponent {}

async function setup() {
  const rendered = await render(HostComponent);
  const q = within(rendered.container as HTMLElement);
  return { ...rendered, q };
}

describe('CountUpDirective', () => {
  it('expose la VALEUR FINALE dans le DOM (jamais « 0 » — assertion non vacue, L-002)', async () => {
    const { q } = await setup();
    const el = q.getByTestId('compteur');
    // À terme, l'élément doit contenir la cible + suffixe. L'animation peut être en cours sur la
    // première frame, mais elle se résout vers la valeur finale exacte. On attend cette résolution.
    await vi.waitFor(() => {
      expect(el.textContent).toBe('500+');
    });
    // Garde-fou explicite : ne JAMAIS rester bloqué sur « 0 » (cf. L-002, assertion vacue).
    expect(el.textContent).not.toBe('0+');
  });

  it('ne marque PAS le compteur comme région live (compteur décoratif)', async () => {
    const { q } = await setup();
    const el = q.getByTestId('compteur');
    // Décision a11y ferme : pas d'aria-live → on n'annonce pas chaque incrément.
    expect(el.getAttribute('aria-live')).toBeNull();
    expect(el.getAttribute('role')).toBeNull();
  });

  it('ne présente aucune violation WCAG A/AA (axe)', async () => {
    const { container } = await setup();
    await expectNoA11yViolations(container);
  });
});
