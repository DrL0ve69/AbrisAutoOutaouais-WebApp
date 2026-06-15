import { render, screen, within, waitFor } from '@testing-library/angular';
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
import { ShelterSuggestionDto } from '../../core/models/shelter-suggestion.model';
import { expectNoA11yViolations } from '../../../testing/axe-helper';

registerLocaleData(localeFrCa);

const VIEWPORT = { width: 1024, height: 768 };

const SHELTER: ShelterSuggestionDto = {
  id: 's1',
  name: 'Abri double Tempo',
  slug: 'abri-double',
  price: 899,
  rentalPrice: 79,
  categoryName: 'Abris doubles',
  imageUrl: null,
  widthCm: 320,
  lengthCm: 620,
  heightCm: 250,
  widthMarginCm: 20,
  lengthMarginCm: 20,
  isTightFit: false,
};

async function setup() {
  await page.viewport(VIEWPORT.width, VIEWPORT.height);
  const places: Partial<PlacesService> = {
    suggest: vi.fn().mockReturnValue(of([])),
    lookupPostalCode: vi.fn().mockReturnValue(of({ postalCode: null })),
    // D4 — l'adresse est saisie manuellement (sans suggestion) → `submit()` géocode avant d'émettre.
    // On renvoie `null` (géocodage infructueux) : la carte retombe sur le repli, le flux continue.
    geocode: vi.fn().mockReturnValue(of(null)),
  };
  const profile: Partial<ProfileService> = {
    ensureLoaded: vi.fn(),
    applyDefaultAddress: vi.fn(),
    // D6 — pas d'adresse de profil ici : l'étape adresse rend le formulaire directement (le
    // parcours de saisie manuelle exercé par ces tests reste inchangé). Computed-like → fonction.
    defaultDeliveryAddress: (() => null) as ProfileService['defaultDeliveryAddress'],
  };
  const shelters: Partial<ShelterSuggestionService> = {
    suggestShelters: vi.fn().mockReturnValue(of([SHELTER])),
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

/** Remplit l'étape adresse manuellement (sans combobox) et passe à l'étape 2. */
async function completeAddress(user: ReturnType<typeof userEvent.setup>, q: ReturnType<typeof within>) {
  await user.type(q.getByLabelText(/numéro civique/i), '123');
  const combo = q.getByRole('combobox', { name: /rue/i });
  await user.click(combo);
  await user.keyboard('123 rue Principale');
  await user.type(q.getByLabelText(/ville/i), 'Gatineau');
  await user.click(q.getByRole('button', { name: /continuer vers la mesure/i }));
}

describe('MesurerComponent — assistant 3 étapes', () => {
  it('navigue Adresse → Mesure → Résultats et appelle suggest-shelters', async () => {
    const user = userEvent.setup();
    const { q, shelters } = await setup();

    // Étape 1.
    expect(q.getByRole('heading', { level: 2, name: /adresse/i })).toBeInTheDocument();
    await completeAddress(user, q);

    // Étape 2 : calculateur par défaut.
    expect(await q.findByRole('heading', { level: 2, name: /mesure/i })).toBeInTheDocument();
    await user.click(q.getByLabelText(/berline/i));
    await user.keyboard('{Backspace}1');
    await user.click(q.getByRole('button', { name: /calculer le gabarit/i }));

    // Étape 3 : résultats.
    expect(await q.findByRole('heading', { level: 2, name: /résultats/i })).toBeInTheDocument();
    expect(shelters.suggestShelters).toHaveBeenCalled();
    expect(await q.findByText('Abri double Tempo')).toBeInTheDocument();
  });

  it('déplace le focus sur le titre d’étape APRÈS le rendu (L-006)', async () => {
    const user = userEvent.setup();
    const { q } = await setup();

    await completeAddress(user, q);

    const measureHeading = await q.findByRole('heading', { level: 2, name: /mesure/i });
    await waitFor(() => expect(measureHeading).toHaveFocus());
  });

  it('annonce l’étape courante dans un status ancré par TEXTE (L-010)', async () => {
    const user = userEvent.setup();
    const { q } = await setup();

    await completeAddress(user, q);
    await q.findByRole('heading', { level: 2, name: /mesure/i });

    // Plusieurs `role="status"` coexistent (annonce d'étape + statut « hors plage » du
    // calculateur, et un status global dans app.html en prod) : on ANCRE PAR TEXTE (L-010),
    // jamais par le rôle nu.
    await waitFor(() => expect(q.getByText(/étape 2 sur 3/i)).toBeInTheDocument());
    expect(q.getByText(/étape 2 sur 3/i)).toHaveAttribute('role', 'status');
  });

  it('ne présente aucune violation WCAG A/AA (étape 1)', async () => {
    const { container } = await setup();
    await expectNoA11yViolations(container);
  });

  it('ne présente aucune violation WCAG A/AA (étape résultats)', async () => {
    const user = userEvent.setup();
    const { container, q } = await setup();
    await completeAddress(user, q);
    await q.findByRole('heading', { level: 2, name: /mesure/i });
    await user.click(q.getByLabelText(/berline/i));
    await user.keyboard('{Backspace}1');
    await user.click(q.getByRole('button', { name: /calculer le gabarit/i }));
    await q.findByText('Abri double Tempo');
    await expectNoA11yViolations(container);
  });
});
