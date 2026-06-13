import { render, within } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { page } from 'vitest/browser';
import { of } from 'rxjs';
import { AddressStepComponent, MesurerAddress } from './address-step';
import { PlacesService } from '../../../../core/services/places.service';
import { PlaceSuggestionDto } from '../../../../core/models/place.model';
import { expectNoA11yViolations } from '../../../../../testing/axe-helper';

const VIEWPORT = { width: 1024, height: 768 };

const SUGGESTIONS: PlaceSuggestionDto[] = [
  {
    label: '111 rue Wellington, Ottawa, ON',
    civicNumber: '111',
    street: 'rue Wellington',
    city: 'Ottawa',
    province: 'ON',
    postalCode: null,
    lat: 45.42,
    lng: -75.7,
  },
];

function placesStub() {
  return {
    suggest: vi.fn().mockReturnValue(of(SUGGESTIONS)),
    lookupPostalCode: vi.fn().mockReturnValue(of({ postalCode: null })),
  };
}

async function setup() {
  await page.viewport(VIEWPORT.width, VIEWPORT.height);
  const emitted: MesurerAddress[] = [];
  const rendered = await render(AddressStepComponent, {
    providers: [{ provide: PlacesService, useValue: placesStub() }],
    on: { addressSelected: (a: MesurerAddress) => emitted.push(a) },
  });
  // Le mode navigateur de vitest partage le `document` : on scope par conteneur (L-013).
  const q = within(rendered.container as HTMLElement);
  return { ...rendered, q, emitted };
}

describe('AddressStepComponent', () => {
  it('expose le combobox d’adresse correctement étiqueté (id unique mesurer-rue)', async () => {
    const { q } = await setup();
    const combo = q.getByRole('combobox', { name: /rue/i });
    expect(combo).toHaveAttribute('id', 'mesurer-rue');
  });

  it('choix d’une suggestion au clavier → émet l’adresse avec lat/lng', async () => {
    const user = userEvent.setup();
    const { q, emitted } = await setup();

    // Numéro civique requis + saisie de la rue via le combobox.
    await user.type(q.getByLabelText(/numéro civique/i), '111');

    const combo = q.getByRole('combobox', { name: /rue/i });
    await user.click(combo);
    await user.keyboard('rue Well');
    await q.findAllByRole('option');
    await user.keyboard('{ArrowDown}{Enter}');

    await user.click(q.getByRole('button', { name: /continuer vers la mesure/i }));

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      street: 'rue Wellington',
      city: 'Ottawa',
      province: 'ON',
      lat: 45.42,
      lng: -75.7,
    });
  });

  it('ne présente aucune violation WCAG A/AA', async () => {
    const { container } = await setup();
    await expectNoA11yViolations(container);
  });
});
