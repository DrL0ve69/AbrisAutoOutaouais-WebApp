import { render, within, waitFor } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { provideRouter } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localeFrCa from '@angular/common/locales/fr-CA';
import { describe, it, expect, vi } from 'vitest';
import { page } from 'vitest/browser';
import { of } from 'rxjs';
import { MesurerComponent } from './mesurer';
import { PlacesService } from '../../core/services/places.service';
import { ProfileService } from '../../core/services/profile.service';
import { ShelterSuggestionService } from '../../core/services/shelter-suggestion.service';
import { ShelterFitResult } from '../../core/models/shelter-fit.model';
import { expectNoA11yViolations } from '../../../testing/axe-helper';

registerLocaleData(localeFrCa);

const VIEWPORT = { width: 1024, height: 768 };

const SHELTER_RESULTS: ShelterFitResult[] = [
  {
    categorySlug: 'abris-doubles',
    categoryName: 'Abris doubles',
    categoryMaxWidthCm: 320,
    models: [
      {
        id: 's1',
        slug: 'abri-double',
        name: 'Abri double Tempo',
        widthCm: 320,
        basePrice: 899,
        minLengthCm: 488,
        lengthStepCm: 122,
        availableLengthsCm: [488, 610],
      },
    ],
  },
];

async function setup() {
  await page.viewport(VIEWPORT.width, VIEWPORT.height);
  const places: Partial<PlacesService> = {
    suggest: vi.fn().mockReturnValue(of([])),
    lookupPostalCode: vi.fn().mockReturnValue(of({ postalCode: null })),
    geocode: vi.fn().mockReturnValue(of(null)),
  };
  const profile: Partial<ProfileService> = {
    ensureLoaded: vi.fn(),
    applyDefaultAddress: vi.fn(),
    defaultDeliveryAddress: (() => null) as ProfileService['defaultDeliveryAddress'],
  };
  const shelters: Partial<ShelterSuggestionService> = {
    suggestModels: vi.fn().mockReturnValue(of(SHELTER_RESULTS)),
  };
  const rendered = await render(MesurerComponent, {
    providers: [
      provideRouter([]),
      { provide: PlacesService, useValue: places },
      { provide: ProfileService, useValue: profile },
      { provide: ShelterSuggestionService, useValue: shelters },
    ],
  });
  const q = within(rendered.container as HTMLElement);
  return { ...rendered, q, shelters };
}

/** Dimensionne via la voie « par véhicules » (défaut) et passe à l'étape Conseil. */
async function dimensionByVehicles(
  user: ReturnType<typeof userEvent.setup>,
  q: ReturnType<typeof within>,
) {
  await user.click(q.getByLabelText(/berline/i));
  await user.keyboard('{Backspace}1');
  await user.click(q.getByRole('button', { name: /calculer le gabarit/i }));
}

describe('MesurerComponent — assistant « Trouver mon abri » (2 étapes)', () => {
  it('navigue Dimensionner → Conseil et appelle la suggestion de modèles', async () => {
    const user = userEvent.setup();
    const { q, shelters } = await setup();

    // Étape 1 : Dimensionner (voie véhicules par défaut, plus d'étape adresse préalable).
    expect(q.getByRole('heading', { level: 2, name: /dimensionner/i })).toBeInTheDocument();
    await dimensionByVehicles(user, q);

    // Étape 2 : Conseil.
    expect(await q.findByRole('heading', { level: 2, name: /conseil/i })).toBeInTheDocument();
    expect(shelters.suggestModels).toHaveBeenCalled();
    expect(await q.findByText('Abri double Tempo')).toBeInTheDocument();
  });

  it('déplace le focus sur le titre d’étape APRÈS le rendu (L-006)', async () => {
    const user = userEvent.setup();
    const { q } = await setup();

    await dimensionByVehicles(user, q);

    const conseilHeading = await q.findByRole('heading', { level: 2, name: /conseil/i });
    await waitFor(() => expect(conseilHeading).toHaveFocus());
  });

  it('annonce l’étape courante dans un status ancré par TEXTE (L-010)', async () => {
    const user = userEvent.setup();
    const { q } = await setup();

    await dimensionByVehicles(user, q);
    await q.findByRole('heading', { level: 2, name: /conseil/i });

    // Plusieurs `role="status"` coexistent (annonce d'étape + statuts internes, et un status
    // global dans app.html en prod) : on ANCRE PAR TEXTE (L-010), jamais par le rôle nu.
    await waitFor(() => expect(q.getByText(/étape 2 sur 2/i)).toBeInTheDocument());
    expect(q.getByText(/étape 2 sur 2/i)).toHaveAttribute('role', 'status');
  });

  it('ne présente aucune violation WCAG A/AA (étape Dimensionner)', async () => {
    const { container } = await setup();
    await expectNoA11yViolations(container);
  });

  it('ne présente aucune violation WCAG A/AA (étape Conseil)', async () => {
    const user = userEvent.setup();
    const { container, q } = await setup();
    await dimensionByVehicles(user, q);
    await q.findByText('Abri double Tempo');
    await expectNoA11yViolations(container);
  });
});
