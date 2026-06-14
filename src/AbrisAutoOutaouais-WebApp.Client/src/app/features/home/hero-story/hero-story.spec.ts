import { render, within } from '@testing-library/angular';
import { describe, it, expect } from 'vitest';
import { page } from 'vitest/browser';
import { provideRouter } from '@angular/router';
import { HeroStoryComponent } from './hero-story';
import { expectNoA11yViolations } from '../../../../testing/axe-helper';

// Viewport déterministe (L-009) — le hero n'est pas gated par breakpoint, mais on fixe la
// fenêtre pour que les éléments soient effectivement rendus (un viewport nul rendrait les
// assertions « visibles/atteignables » vacues). 1280×800 = variante desktop pleine.
const VIEWPORT = { width: 1280, height: 800 };

async function setup() {
  await page.viewport(VIEWPORT.width, VIEWPORT.height);
  const rendered = await render(HeroStoryComponent, {
    providers: [provideRouter([])],
  });
  const q = within(rendered.container as HTMLElement);
  return { ...rendered, q };
}

describe('HeroStoryComponent', () => {
  // Le hero est STATIQUE : tout le contenu sémantique est rendu d'emblée (pas d'animation
  // au défilement). On vérifie le contenu sans interaction.
  it('rend le h1, les deux CTA et les 3 statistiques', async () => {
    const { q } = await setup();

    // h1 — le LCP, présent dès le rendu.
    expect(q.getByRole('heading', { level: 1, name: /protégez votre véhicule/i })).toBeTruthy();

    // CTA boutique + installation (liens routés, nommés par leur aria-label).
    expect(q.getByRole('link', { name: /catalogue d'abris/i })).toBeTruthy();
    expect(q.getByRole('link', { name: /installation à domicile/i })).toBeTruthy();

    // Stats : la liste « Chiffres clés » et ses 3 items.
    const stats = q.getByRole('list', { name: /chiffres clés/i });
    expect(within(stats).getAllByRole('listitem')).toHaveLength(3);
  });

  it('lie la légende au h1 (aria-labelledby) sans décor à lire', async () => {
    const { container } = await setup();
    // La <section> racine porte le marqueur `data-hero-story` ET aria-labelledby (même nœud).
    const section = container.querySelector('section[data-hero-story]');
    expect(section).toBeTruthy();
    expect(section?.getAttribute('aria-labelledby')).toBe('hero-heading');
    expect(container.querySelector('#hero-heading')).toBeTruthy();
  });

  // Les deux CTA sont des liens natifs focusables.
  it('contenu sémantique atteignable au clavier (CTA focusables)', async () => {
    const { q } = await setup();
    const links = q.getAllByRole('link');
    expect(links.length).toBeGreaterThanOrEqual(2);
    links[0].focus();
    expect(document.activeElement).toBe(links[0]);
  });

  it('ne présente aucune violation WCAG A/AA (axe)', async () => {
    const { container } = await setup();
    await expectNoA11yViolations(container);
  });
});
