import { render, screen } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { page } from 'vitest/browser';
import { signal } from '@angular/core';
import { NavbarComponent } from './navbar';
import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../core/services/cart.service';
import { expectNoA11yViolations } from '../../../../testing/axe-helper';

// ── Bug-08 : un menu FERMÉ ne doit pas être atteignable au clavier ──────────
// L'ancien mécanisme (aria-hidden + pointer-events:none) laissait les liens du
// menu déroulant et du panneau mobile dans l'ordre de tabulation (WCAG 2.4.3).
// Le remplacement par l'attribut natif `inert` les rend réellement infocusables.
// Conformément à L-006, on vérifie le focus RÉEL (tentative de focus +
// toHaveFocus), pas un simple attribut.

function authStub(authenticated = true) {
  return {
    isAuthenticated: signal(authenticated),
    isAdmin: signal(false),
    // Lien « Planning » (US-11.1) conditionné par isStaff() — sans ce signal dans le
    // stub, le template lèverait à la détection de changement (auth.isStaff undefined).
    isStaff: signal(false),
    fullName: signal('Jeanne Tremblay'),
    avatar: signal<string | null>(null),
    logout: vi.fn(),
  };
}

async function setup(viewport: { width: number; height: number }) {
  await page.viewport(viewport.width, viewport.height);
  const rendered = await render(NavbarComponent, {
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: authStub() },
      { provide: CartService, useValue: { count: signal(0) } },
    ],
  });
  return rendered;
}

const DESKTOP = { width: 1280, height: 800 }; // ≥ 1024px → menu utilisateur visible
const MOBILE = { width: 414, height: 896 }; // < 1024px → hamburger + panneau mobile

describe('NavbarComponent — menu utilisateur (desktop)', () => {
  it('fermé : les éléments du menu sont inertes et infocusables', async () => {
    const { container } = await setup(DESKTOP);

    const profileLink = container.querySelector<HTMLAnchorElement>('#user-dropdown a');
    expect(profileLink).not.toBeNull();

    // Le sous-arbre est bien marqué inert…
    expect(profileLink!.closest('[inert]')).not.toBeNull();

    // …et une tentative de focus RÉELLE échoue (l'élément ne peut pas le recevoir).
    profileLink!.focus();
    expect(profileLink).not.toHaveFocus();
  });

  it('ouvert : les éléments du menu redeviennent focusables', async () => {
    const user = userEvent.setup();
    await setup(DESKTOP);

    await user.click(screen.getByRole('button', { name: /menu de jeanne tremblay/i }));

    const profileLink = await screen.findByRole('menuitem', { name: /mon profil/i });
    expect(profileLink.closest('[inert]')).toBeNull();

    profileLink.focus();
    expect(profileLink).toHaveFocus();
  });

  it('ne présente aucune violation WCAG A/AA (fermé puis ouvert)', async () => {
    const user = userEvent.setup();
    const { container } = await setup(DESKTOP);

    await expectNoA11yViolations(container);

    await user.click(screen.getByRole('button', { name: /menu de jeanne tremblay/i }));
    await screen.findByRole('menuitem', { name: /mon profil/i });
    await expectNoA11yViolations(container);
  });
});

describe('NavbarComponent — menu mobile', () => {
  it('fermé : les liens du panneau mobile sont inertes et infocusables', async () => {
    const { container } = await setup(MOBILE);

    const homeLink = container.querySelector<HTMLAnchorElement>('#mobile-menu a');
    expect(homeLink).not.toBeNull();
    expect(homeLink!.closest('[inert]')).not.toBeNull();

    homeLink!.focus();
    expect(homeLink).not.toHaveFocus();
  });

  it('ouvert : les liens du panneau mobile redeviennent focusables', async () => {
    const user = userEvent.setup();
    const { container } = await setup(MOBILE);

    await user.click(screen.getByRole('button', { name: /ouvrir le menu de navigation/i }));

    const homeLink = container.querySelector<HTMLAnchorElement>('#mobile-menu a');
    expect(homeLink!.closest('[inert]')).toBeNull();

    homeLink!.focus();
    expect(homeLink).toHaveFocus();
  });

  it('ne présente aucune violation WCAG A/AA (fermé puis ouvert)', async () => {
    const user = userEvent.setup();
    const { container } = await setup(MOBILE);

    await expectNoA11yViolations(container);

    await user.click(screen.getByRole('button', { name: /ouvrir le menu de navigation/i }));
    await expectNoA11yViolations(container);
  });
});
