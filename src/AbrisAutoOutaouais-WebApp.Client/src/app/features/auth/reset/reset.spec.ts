import { render, screen, waitFor } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ResetComponent } from './reset';
import { AuthService } from '../../../core/services/auth.service';
import { expectNoA11yViolations } from '../../../../testing/axe-helper';

const EMAIL = 'client@test.com';
const TOKEN = 'CfDJ8-jeton-de-test';

async function setup(opts: {
  inputs?: Record<string, unknown>;
  forgotPassword?: ReturnType<typeof vi.fn>;
  resetPassword?: ReturnType<typeof vi.fn>;
} = {}) {
  const forgotPassword = opts.forgotPassword ?? vi.fn().mockReturnValue(of(undefined));
  const resetPassword = opts.resetPassword ?? vi.fn().mockReturnValue(of(undefined));
  const authStub: Partial<AuthService> = { forgotPassword, resetPassword };

  const rendered = await render(ResetComponent, {
    inputs: opts.inputs ?? {},
    providers: [provideRouter([]), { provide: AuthService, useValue: authStub }],
  });
  return { ...rendered, forgotPassword, resetPassword };
}

describe('ResetComponent — mode demande (sans jeton)', () => {
  it('affiche le formulaire de demande puis la confirmation neutre, focalisée (L-006)', async () => {
    const user = userEvent.setup();
    const { forgotPassword, container } = await setup();

    expect(
      screen.getByRole('heading', { level: 1, name: /réinitialiser le mot de passe/i }),
    ).toBeInTheDocument();
    await expectNoA11yViolations(container);

    await user.type(screen.getByLabelText(/adresse courriel/i), EMAIL);
    await user.click(screen.getByRole('button', { name: /envoyer le lien/i }));

    expect(forgotPassword).toHaveBeenCalledWith(EMAIL);
    const confirm = await screen.findByRole('status');
    expect(confirm).toHaveTextContent(/si un compte correspond/i);
    // Le bouton soumis a disparu du DOM : le focus doit suivre la confirmation.
    await waitFor(() => expect(confirm).toHaveFocus());
    await expectNoA11yViolations(container);
  });

  it('affiche la MÊME confirmation neutre quand l’API échoue (anti-énumération)', async () => {
    const user = userEvent.setup();
    const { forgotPassword } = await setup({
      forgotPassword: vi.fn().mockReturnValue(throwError(() => ({ status: 500 }))),
    });

    await user.type(screen.getByLabelText(/adresse courriel/i), EMAIL);
    await user.click(screen.getByRole('button', { name: /envoyer le lien/i }));

    expect(forgotPassword).toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent(/si un compte correspond/i);
  });

  it('ne soumet pas un courriel invalide', async () => {
    const user = userEvent.setup();
    const { forgotPassword } = await setup();

    await user.type(screen.getByLabelText(/adresse courriel/i), 'pas-un-courriel');
    await user.click(screen.getByRole('button', { name: /envoyer le lien/i }));

    expect(forgotPassword).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/format de courriel invalide/i);
  });
});

describe('ResetComponent — mode réinitialisation (jeton dans l’URL)', () => {
  const inputs = { email: EMAIL, token: TOKEN };

  it('réinitialise puis déplace le focus sur le titre de succès (L-006)', async () => {
    const user = userEvent.setup();
    const { resetPassword, container } = await setup({ inputs });

    expect(
      screen.getByRole('heading', { level: 1, name: /choisir un nouveau mot de passe/i }),
    ).toBeInTheDocument();
    await expectNoA11yViolations(container);

    await user.type(screen.getByLabelText(/nouveau mot de passe/i), 'Nouveau@123');
    await user.type(screen.getByLabelText(/confirmer le mot de passe/i), 'Nouveau@123');
    await user.click(screen.getByRole('button', { name: /réinitialiser le mot de passe/i }));

    expect(resetPassword).toHaveBeenCalledWith({
      email: EMAIL,
      token: TOKEN,
      newPassword: 'Nouveau@123',
      confirmPassword: 'Nouveau@123',
    });

    const heading = await screen.findByRole('heading', {
      level: 2,
      name: /mot de passe réinitialisé/i,
    });
    // Le formulaire (et son bouton) a disparu : focus sur le titre, APRÈS rendu.
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByRole('link', { name: /se connecter/i })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it('affiche l’erreur du serveur (jeton invalide) sans masquer le formulaire', async () => {
    const user = userEvent.setup();
    const serverMessage = 'Le lien de réinitialisation est invalide ou expiré.';
    const { container } = await setup({
      inputs,
      resetPassword: vi
        .fn()
        .mockReturnValue(throwError(() => ({ status: 400, error: { error: serverMessage } }))),
    });

    await user.type(screen.getByLabelText(/nouveau mot de passe/i), 'Nouveau@123');
    await user.type(screen.getByLabelText(/confirmer le mot de passe/i), 'Nouveau@123');
    await user.click(screen.getByRole('button', { name: /réinitialiser le mot de passe/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(serverMessage);
    // Le formulaire reste utilisable pour réessayer.
    expect(
      screen.getByRole('button', { name: /réinitialiser le mot de passe/i }),
    ).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it('bloque la soumission quand les mots de passe ne correspondent pas', async () => {
    const user = userEvent.setup();
    const { resetPassword } = await setup({ inputs });

    await user.type(screen.getByLabelText(/nouveau mot de passe/i), 'Nouveau@123');
    await user.type(screen.getByLabelText(/confirmer le mot de passe/i), 'Different@456');
    await user.click(screen.getByRole('button', { name: /réinitialiser le mot de passe/i }));

    expect(resetPassword).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/ne correspondent pas/i);
  });
});
