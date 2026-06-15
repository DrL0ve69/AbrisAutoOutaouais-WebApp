import { render, within, waitFor } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { page } from 'vitest/browser';
import { Component, signal } from '@angular/core';
import { AddressChoiceComponent } from './address-choice.component';
import { AddressDto } from '../../../../core/models/booking.model';
import { expectNoA11yViolations } from '../../../../../testing/axe-helper';

const VIEWPORT = { width: 1024, height: 768 };

const PROFILE_ADDRESS: AddressDto = {
  civicNumber: '111',
  street: 'rue Wellington',
  apartment: '4B',
  city: 'Ottawa',
  province: 'ON',
  postalCode: 'K1A 0A6',
  country: 'Canada',
};

// Hôte minimal : titre de section (headingId) + contenu projeté identifiable (le « formulaire »).
@Component({
  selector: 'app-host',
  imports: [AddressChoiceComponent],
  template: `
    <h1 id="screen-heading">Adresse de livraison</h1>
    <app-address-choice
      [profileAddress]="profileAddress()"
      headingId="screen-heading"
      (modeChange)="lastMode.set($event)">
      <input data-testid="projected-street" aria-label="Rue" />
    </app-address-choice>
  `,
})
class HostComponent {
  readonly profileAddress = signal<AddressDto | null>(PROFILE_ADDRESS);
  readonly lastMode = signal<'profile' | 'other' | null>(null);
}

async function setup(profileAddress: AddressDto | null = PROFILE_ADDRESS) {
  await page.viewport(VIEWPORT.width, VIEWPORT.height);
  const rendered = await render(HostComponent, {
    componentProperties: { profileAddress: signal(profileAddress) },
  });
  // Le mode navigateur de vitest partage le `document` : on scope par conteneur (L-013).
  const q = within(rendered.container as HTMLElement);
  return { ...rendered, q };
}

describe('AddressChoiceComponent', () => {
  it('connecté avec adresse : affiche la pastille (adresse formatée) et MASQUE le formulaire projeté', async () => {
    const { q } = await setup(PROFILE_ADDRESS);

    // Positif : la pastille est rendue avec l'adresse formatée.
    expect(q.getByText('Adresse de mon profil')).toBeInTheDocument();
    expect(q.getByText('111 rue Wellington, app. 4B, Ottawa, ON K1A 0A6')).toBeInTheDocument();
    expect(q.getByRole('button', { name: /utiliser une autre adresse/i })).toBeInTheDocument();

    // Négatif : le formulaire projeté n'est PAS dans le DOM en mode profil.
    expect(q.queryByTestId('projected-street')).toBeNull();
  });

  it('clic « Utiliser une autre adresse » : affiche le formulaire projeté, émet modeChange(other) et focalise le bouton retour (L-006)', async () => {
    const user = userEvent.setup();
    const { q, fixture } = await setup(PROFILE_ADDRESS);

    await user.click(q.getByRole('button', { name: /utiliser une autre adresse/i }));

    // Positif : le formulaire projeté est désormais visible et éditable.
    expect(q.getByTestId('projected-street')).toBeInTheDocument();
    // La pastille a disparu.
    expect(q.queryByText('Adresse de mon profil')).toBeNull();

    const host = fixture.componentInstance as HostComponent;
    expect(host.lastMode()).toBe('other');

    // Focus APRÈS rendu sur le bouton retour (cible stable du template, L-006).
    const backButton = q.getByRole('button', { name: /utiliser l'adresse de mon profil/i });
    await waitFor(() => expect(backButton).toHaveFocus());
  });

  it('retour vers le profil : ré-affiche la pastille, émet modeChange(profile) et focalise « autre adresse »', async () => {
    const user = userEvent.setup();
    const { q, fixture } = await setup(PROFILE_ADDRESS);

    await user.click(q.getByRole('button', { name: /utiliser une autre adresse/i }));
    await user.click(q.getByRole('button', { name: /utiliser l'adresse de mon profil/i }));

    const host = fixture.componentInstance as HostComponent;
    expect(host.lastMode()).toBe('profile');
    expect(q.getByText('Adresse de mon profil')).toBeInTheDocument();
    expect(q.queryByTestId('projected-street')).toBeNull();

    const otherButton = q.getByRole('button', { name: /utiliser une autre adresse/i });
    await waitFor(() => expect(otherButton).toHaveFocus());
  });

  it('parcours anonyme (profileAddress=null) : rend DIRECTEMENT le formulaire, AUCUNE pastille ni bouton (frontière dure)', async () => {
    const { q } = await setup(null);

    // Positif : le formulaire projeté est rendu d'emblée.
    expect(q.getByTestId('projected-street')).toBeInTheDocument();

    // Négatif : aucune pastille, aucun bouton de bascule.
    expect(q.queryByText('Adresse de mon profil')).toBeNull();
    expect(q.queryByRole('button', { name: /utiliser une autre adresse/i })).toBeNull();
    expect(q.queryByRole('button', { name: /utiliser l'adresse de mon profil/i })).toBeNull();
  });

  it('ne présente aucune violation WCAG A/AA (pastille puis formulaire)', async () => {
    const user = userEvent.setup();
    const { container, q } = await setup(PROFILE_ADDRESS);

    await expectNoA11yViolations(container);

    await user.click(q.getByRole('button', { name: /utiliser une autre adresse/i }));
    await expectNoA11yViolations(container);
  });
});
