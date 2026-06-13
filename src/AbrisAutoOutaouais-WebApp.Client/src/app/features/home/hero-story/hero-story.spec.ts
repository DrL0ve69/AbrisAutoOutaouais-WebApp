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
  // E2 : le hero doit être SIGNIFIANT sans défilement ni JS (le serveur rend la scène finale ;
  // le contenu sémantique occupe sa boîte définitive). On vérifie le contenu SANS scroll.
  it('rend le h1, les deux CTA et les 3 statistiques sans défilement', async () => {
    const { q } = await setup();

    // h1 — le LCP, présent dès le rendu (pas d'animation requise).
    expect(q.getByRole('heading', { level: 1, name: /protégez votre véhicule/i })).toBeTruthy();

    // CTA boutique + installation (liens routés, nommés par leur aria-label).
    expect(q.getByRole('link', { name: /catalogue d'abris/i })).toBeTruthy();
    expect(q.getByRole('link', { name: /installation à domicile/i })).toBeTruthy();

    // Stats : la liste « Chiffres clés » et ses 3 items.
    const stats = q.getByRole('list', { name: /chiffres clés/i });
    expect(within(stats).getAllByRole('listitem')).toHaveLength(3);
  });

  it('lie la légende au h1 (aria-labelledby) et masque toute la décoration', async () => {
    const { container, fixture } = await setup();
    // La <section> racine porte le hook E5 `data-hero-story` ET aria-labelledby (même nœud).
    const section = container.querySelector('section[data-hero-story]');
    expect(section).toBeTruthy();
    expect(section?.getAttribute('aria-labelledby')).toBe('hero-heading');
    expect(container.querySelector('#hero-heading')).toBeTruthy();
    // `data-motion` est reflété sur l'hôte <app-hero-story> (hook E5) : 'on' par défaut, puis
    // 'on'|'reduced' selon la préférence média une fois GSAP chargé (afterNextRender).
    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute('data-motion')).toMatch(/^(on|reduced)$/);

    // SVG décoratif + légendes du récit sont aria-hidden (non lus par les LT).
    expect(container.querySelector('[data-hero-svg]')?.getAttribute('aria-hidden')).toBe('true');
    expect(
      container.querySelector('.hero-story__beats')?.getAttribute('aria-hidden'),
    ).toBe('true');
    // Aucune légende décorative ne doit exposer de nom accessible.
    expect(container.querySelectorAll('[data-beat]').length).toBe(4);
  });

  // Contenu atteignable au clavier indépendamment du mode mouvement : les deux CTA sont des
  // liens natifs focusables (jamais inertés ni retirés par l'animation, qui ne touche que la
  // décoration). Le branchement réel pin/scrub vs statique (prefers-reduced-motion) est couvert
  // par le Playwright d'E5, qui peut émuler la préférence média — pas le runner vitest.
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
