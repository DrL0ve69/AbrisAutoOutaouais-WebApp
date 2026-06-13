import { render, screen } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { AuthComponent } from './auth';
import { AuthService, AvailabilityResponse } from '../../core/services/auth.service';
import { expectNoA11yViolations } from '../../../testing/axe-helper';

/**
 * Validateurs asynchrones de disponibilité (H5) sur le formulaire d'inscription.
 * On bascule sur l'onglet inscription puis on observe le message de champ
 * (« déjà pris » / « disponible »), piloté par le stub AuthService.checkAvailability.
 */
async function setup(
  checkAvailability = vi.fn<(p: { username?: string; email?: string }) => unknown>(),
) {
  const authStub: Partial<AuthService> = {
    checkAvailability: checkAvailability as AuthService['checkAvailability'],
    login: vi.fn(),
    register: vi.fn(),
  };
  const rendered = await render(AuthComponent, {
    providers: [provideRouter([]), { provide: AuthService, useValue: authStub }],
  });
  // Passer du formulaire de connexion à l'inscription. Le basculement est animé
  // (flip ~320 ms × 2 via setTimeout) : on attend que le formulaire d'inscription
  // soit rendu ET que l'animation soit retombée, sinon les timers d'animation
  // entrent en collision avec la détection de changements de user-event (NG0101).
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /s'inscrire/i }));
  await screen.findByRole('heading', { level: 1, name: /créer un compte/i });
  // Laisse les deux demi-animations (out + in) se terminer avant toute saisie.
  await new Promise(r => setTimeout(r, 720));
  return { ...rendered, user, checkAvailability };
}

const available = (over: Partial<AvailabilityResponse>): AvailabilityResponse => ({
  usernameAvailable: null,
  emailAvailable: null,
  ...over,
});

describe('AuthComponent — disponibilité asynchrone (H5)', () => {
  it('annonce « déjà pris » quand le nom d’utilisateur est indisponible', async () => {
    const check = vi.fn().mockReturnValue(of(available({ usernameAvailable: false })));
    const { user } = await setup(check);

    await user.type(screen.getByLabelText(/nom d'utilisateur/i), 'admin');
    await user.tab(); // blur → le champ devient « touched » (affichage de l'erreur)

    // Le validateur est debounced (~400 ms) → on attend l'annonce du résultat.
    expect(await screen.findByText(/déjà pris/i, {}, { timeout: 2000 })).toBeInTheDocument();
    expect(check).toHaveBeenCalledWith({ username: 'admin' });
  });

  it('annonce « disponible » quand le nom d’utilisateur est libre', async () => {
    const check = vi.fn().mockReturnValue(of(available({ usernameAvailable: true })));
    const { user } = await setup(check);

    await user.type(screen.getByLabelText(/nom d'utilisateur/i), 'nouveau');

    expect(
      await screen.findByText(/nom d'utilisateur disponible/i, {}, { timeout: 2000 }),
    ).toBeInTheDocument();
  });

  it('annonce « courriel déjà utilisé » quand le courriel est pris', async () => {
    const check = vi.fn().mockReturnValue(of(available({ emailAvailable: false })));
    const { user } = await setup(check);

    await user.type(screen.getByLabelText(/adresse courriel/i), 'pris@test.com');
    await user.tab(); // blur → « touched » pour afficher le message d'erreur

    expect(
      await screen.findByText(/un compte existe déjà avec ce courriel/i, {}, { timeout: 2000 }),
    ).toBeInTheDocument();
    expect(check).toHaveBeenCalledWith({ email: 'pris@test.com' });
  });

  it('n’interroge PAS le serveur pour un nom d’utilisateur invalide (sync) — pas d’écrasement', async () => {
    const check = vi.fn().mockReturnValue(of(available({})));
    const { user } = await setup(check);

    // « ab » échoue la règle synchrone minlength(3) → l'async ne doit pas partir.
    await user.type(screen.getByLabelText(/nom d'utilisateur/i), 'ab');
    await user.tab(); // blur → « touched » pour afficher l'erreur de format

    // Laisse passer le délai de debounce pour prouver l'absence d'appel.
    await new Promise(r => setTimeout(r, 600));
    expect(check).not.toHaveBeenCalled();
    // L'erreur de format reste affichée (non masquée par l'async).
    expect(screen.getByText(/minimum 3 caractères/i)).toBeInTheDocument();
  });

  it('reste sans violation axe avec un message « déjà pris » affiché', async () => {
    const check = vi.fn().mockReturnValue(of(available({ usernameAvailable: false })));
    const { user, container } = await setup(check);

    await user.type(screen.getByLabelText(/nom d'utilisateur/i), 'admin');
    await user.tab();
    await screen.findByText(/déjà pris/i, {}, { timeout: 2000 });

    await expectNoA11yViolations(container);
  });
});
