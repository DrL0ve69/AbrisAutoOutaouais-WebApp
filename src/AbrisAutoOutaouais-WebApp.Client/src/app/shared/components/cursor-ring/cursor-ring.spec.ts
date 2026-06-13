import { render } from '@testing-library/angular';
import { describe, it, expect } from 'vitest';
import { CursorRingComponent } from './cursor-ring';
import { expectNoA11yViolations } from '../../../../testing/axe-helper';

async function setup() {
  return render(CursorRingComponent);
}

describe('CursorRingComponent', () => {
  it('est décoratif : aria-hidden sur l\'hôte, ne capte aucun événement', async () => {
    const { fixture } = await setup();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute('aria-hidden')).toBe('true');
    // L'anneau ne doit jamais intercepter le pointeur (n'altère ni clics ni locators).
    const dot = host.querySelector<HTMLElement>('.cursor-ring__dot');
    expect(dot).toBeTruthy();
    expect(getComputedStyle(dot as HTMLElement).pointerEvents).toBe('none');
  });

  it('n\'expose aucun nom/rôle accessible (invisible pour les lecteurs d\'écran)', async () => {
    const { container } = await setup();
    // aria-hidden masque tout le sous-arbre : aucun rôle exposé.
    expect(container.querySelector('[role]')).toBeNull();
  });

  it('ne présente aucune violation WCAG A/AA (axe)', async () => {
    const { container } = await setup();
    await expectNoA11yViolations(container);
  });
});
