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

// Suggestion proche de la base (Ottawa-Gatineau) → DANS la zone de service.
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

/**
 * Stub `PlacesService`. `geocodeResult` pilote la 1re suggestion renvoyée par `geocode` (D4) —
 * `null` = géocodage infructueux ; sinon les lat/lng simulent l'adresse localisée. `suggest`
 * reste vide par défaut (l'autocomplétion n'est pas exercée ici).
 */
function placesStub(geocodeResult: PlaceSuggestionDto | null = null) {
  return {
    suggest: vi.fn().mockReturnValue(of(SUGGESTIONS)),
    lookupPostalCode: vi.fn().mockReturnValue(of({ postalCode: null })),
    geocode: vi.fn().mockReturnValue(of(geocodeResult)),
  };
}

async function setup(geocodeResult: PlaceSuggestionDto | null = null) {
  await page.viewport(VIEWPORT.width, VIEWPORT.height);
  const emitted: MesurerAddress[] = [];
  const stub = placesStub(geocodeResult);
  const rendered = await render(AddressStepComponent, {
    providers: [{ provide: PlacesService, useValue: stub }],
    on: { addressSelected: (a: MesurerAddress) => emitted.push(a) },
  });
  // Le mode navigateur de vitest partage le `document` : on scope par conteneur (L-013).
  const q = within(rendered.container as HTMLElement);
  return { ...rendered, q, emitted, stub };
}

/** Remplit les 3 champs requis (civique/rue/ville) sans choisir de suggestion. */
async function fillManual(
  user: ReturnType<typeof userEvent.setup>,
  q: ReturnType<typeof within>,
  city = 'Gatineau',
): Promise<void> {
  await user.type(q.getByLabelText(/numéro civique/i), '123');
  await user.type(q.getByRole('combobox', { name: /rue/i }), '123 rue Principale');
  await user.type(q.getByLabelText(/ville/i), city);
}

describe('AddressStepComponent', () => {
  it('expose le combobox d’adresse correctement étiqueté (id unique mesurer-rue)', async () => {
    const { q } = await setup();
    const combo = q.getByRole('combobox', { name: /rue/i });
    expect(combo).toHaveAttribute('id', 'mesurer-rue');
  });

  it('choix d’une suggestion au clavier → émet l’adresse avec lat/lng (en zone)', async () => {
    const user = userEvent.setup();
    const { q, emitted, stub } = await setup();

    await user.type(q.getByLabelText(/numéro civique/i), '111');

    const combo = q.getByRole('combobox', { name: /rue/i });
    await user.click(combo);
    await user.keyboard('rue Well');
    await q.findAllByRole('option');
    await user.keyboard('{ArrowDown}{Enter}');

    await user.click(q.getByRole('button', { name: /continuer vers la mesure/i }));

    // Une suggestion porte déjà lat/lng → PAS de géocodage à la soumission.
    expect(stub.geocode).not.toHaveBeenCalled();
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      street: 'rue Wellington',
      city: 'Ottawa',
      province: 'ON',
      lat: 45.42,
      lng: -75.7,
      outOfServiceArea: false, // Ottawa ≈ base → en zone
    });
  });

  it('saisie SANS suggestion → géocode à la soumission et émet les lat/lng résolus (D4)', async () => {
    const user = userEvent.setup();
    // Adresse géocodée proche de la base → en zone.
    const { q, emitted, stub } = await setup({
      label: '123 rue Principale, Gatineau, QC',
      civicNumber: '123',
      street: 'rue Principale',
      city: 'Gatineau',
      province: 'QC',
      postalCode: null,
      lat: 45.48,
      lng: -75.65,
    });

    await fillManual(user, q);
    await user.click(q.getByRole('button', { name: /continuer vers la mesure/i }));

    expect(stub.geocode).toHaveBeenCalledOnce();
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      lat: 45.48,
      lng: -75.65,
      outOfServiceArea: false,
    });
  });

  it('adresse géocodée HORS zone → émet outOfServiceArea = true (D5, non bloquant)', async () => {
    const user = userEvent.setup();
    // Montréal (~160 km) → hors zone.
    const { q, emitted } = await setup({
      label: '1000 rue Sainte-Catherine, Montréal, QC',
      civicNumber: '1000',
      street: 'rue Sainte-Catherine',
      city: 'Montréal',
      province: 'QC',
      postalCode: null,
      lat: 45.5019,
      lng: -73.5674,
    });

    await fillManual(user, q, 'Montréal');
    await user.click(q.getByRole('button', { name: /continuer vers la mesure/i }));

    expect(emitted).toHaveLength(1);
    expect(emitted[0].outOfServiceArea).toBe(true);
  });

  it('géocodage infructueux → émet lat/lng null sans bloquer (outOfServiceArea = false)', async () => {
    const user = userEvent.setup();
    const { q, emitted } = await setup(null); // aucune suggestion résolue

    await fillManual(user, q);
    await user.click(q.getByRole('button', { name: /continuer vers la mesure/i }));

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      lat: null,
      lng: null,
      outOfServiceArea: false, // pas de coordonnées ⇒ pas d'affirmation « hors zone »
    });
  });

  it('ne présente aucune violation WCAG A/AA', async () => {
    const { container } = await setup();
    await expectNoA11yViolations(container);
  });
});
