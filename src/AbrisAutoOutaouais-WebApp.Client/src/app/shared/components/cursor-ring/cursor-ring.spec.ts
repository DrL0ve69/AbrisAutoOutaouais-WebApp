import { render } from '@testing-library/angular';
import { describe, it, expect } from 'vitest';
import { CursorRingComponent } from './cursor-ring';
import { expectNoA11yViolations } from '../../../../testing/axe-helper';

async function setup() {
  return render(CursorRingComponent);
}

describe('CursorRingComponent', () => {
  it('est décoratif : aria-hidden sur l\'hôte, point ET anneau ne captent aucun événement', async () => {
    const { fixture, container } = await setup();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute('aria-hidden')).toBe('true');
    // Ni le point ni l'anneau ne doivent intercepter le pointeur (n'altèrent ni clics ni locators).
    const dot = container.querySelector<HTMLElement>('.cursor-ring__dot');
    const ring = container.querySelector<HTMLElement>('.cursor-ring__ring');
    expect(dot).toBeTruthy();
    expect(ring).toBeTruthy();
    expect(getComputedStyle(dot as HTMLElement).pointerEvents).toBe('none');
    expect(getComputedStyle(ring as HTMLElement).pointerEvents).toBe('none');
  });

  it('n\'expose aucun nom/rôle accessible (invisible pour les lecteurs d\'écran)', async () => {
    const { container } = await setup();
    // aria-hidden masque tout le sous-arbre : aucun rôle exposé.
    expect(container.querySelector('[role]')).toBeNull();
    // Anti-vacuité (L-009) : prouve que les DEUX éléments décoratifs sont bien rendus.
    expect(
      container.querySelectorAll('.cursor-ring__dot, .cursor-ring__ring').length,
    ).toBe(2);
  });

  it('ne présente aucune violation WCAG A/AA (axe)', async () => {
    const { container } = await setup();
    await expectNoA11yViolations(container);
  });
});
