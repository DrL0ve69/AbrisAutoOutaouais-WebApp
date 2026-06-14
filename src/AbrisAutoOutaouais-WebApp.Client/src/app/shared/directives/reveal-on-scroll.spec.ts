import { Component } from '@angular/core';
import { render, within } from '@testing-library/angular';
import { describe, it, expect } from 'vitest';
import { RevealOnScrollDirective } from './reveal-on-scroll';
import { expectNoA11yViolations } from '../../../testing/axe-helper';

@Component({
  imports: [RevealOnScrollDirective],
  template: `<section appRevealOnScroll data-testid="cible">
    <p>Contenu révélé au défilement.</p>
  </section>`,
})
class HostComponent {}

async function setup() {
  const rendered = await render(HostComponent);
  const q = within(rendered.container as HTMLElement);
  return { ...rendered, q };
}

describe('RevealOnScrollDirective', () => {
  it('rend le contenu sémantique (jamais masqué en CSS au repos — pas d\'invisibilité)', async () => {
    const { q } = await setup();
    // Le texte doit être présent et accessible quel que soit l'état d'animation : la directive
    // ne masque qu'en JS via `.is-revealable`, et seulement après init côté navigateur.
    expect(q.getByText(/contenu révélé au défilement/i)).toBeTruthy();
  });

  it('reflète data-motion sur l\'élément hôte', async () => {
    const { q } = await setup();
    const el = q.getByTestId('cible');
    expect(el.getAttribute('data-motion')).toMatch(/^(on|reduced)$/);
  });

  it('ne présente aucune violation WCAG A/AA (axe)', async () => {
    const { container } = await setup();
    await expectNoA11yViolations(container);
  });
});
