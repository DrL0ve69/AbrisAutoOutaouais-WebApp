import { render, within } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { FormGroup } from '@angular/forms';
import { signal, type WritableSignal } from '@angular/core';
import { describe, it, expect, vi } from 'vitest';
import { page } from 'vitest/browser';
import { of } from 'rxjs';
import { MapVoieComponent } from './map-voie';
import { PlacesService } from '../../../../../core/services/places.service';
import { ProfileService } from '../../../../../core/services/profile.service';
import { PlaceSuggestionDto } from '../../../../../core/models/place.model';
import { AddressDto } from '../../../../../core/models/booking.model';
import { Footprint } from '../../../util/footprint.util';
import { expectNoA11yViolations } from '../../../../../../testing/axe-helper';

const VIEWPORT = { width: 1024, height: 768 };

/**
 * Stub `PlacesService`. `geocodeResult` pilote la suggestion renvoyée par `geocode` (D4) — `null`
 * = géocodage infructueux. `suggest` reste vide (l'autocomplétion n'est pas exercée par défaut).
 */
function placesStub(geocodeResult: PlaceSuggestionDto | null = null) {
  return {
    suggest: vi.fn().mockReturnValue(of<PlaceSuggestionDto[]>([])),
    lookupPostalCode: vi.fn().mockReturnValue(of({ postalCode: null })),
    geocode: vi.fn().mockReturnValue(of(geocodeResult)),
  };
}

/**
 * Stub `ProfileService`. `address` = SIGNAL exposé par `defaultDeliveryAddress` (null = invité) —
 * writable pour simuler l'arrivée ASYNCHRONE de l'adresse (/auth/me) après le rendu. `applyDefaultAddress`
 * reproduit la VRAIE sémantique (force ⇒ copie inconditionnelle, sinon pristine-only L-002) en lisant
 * le signal de façon DYNAMIQUE, pour exercer le pré-remplissage et l'auto-centrage réels.
 */
function profileStub(address: WritableSignal<AddressDto | null>) {
  return {
    ensureLoaded: vi.fn(),
    defaultDeliveryAddress: address as ProfileService['defaultDeliveryAddress'],
    applyDefaultAddress: vi.fn((form: FormGroup, addr: AddressDto | null = address(), force = false) => {
      if (!addr) return;
      const values: Record<string, string> = {
        civicNumber: addr.civicNumber,
        street: addr.street,
        city: addr.city,
        province: addr.province,
      };
      for (const [name, value] of Object.entries(values)) {
        const control = form.get(name);
        if (control && (force || control.pristine)) control.setValue(value);
      }
    }),
  };
}

async function setup(opts: {
  geocodeResult?: PlaceSuggestionDto | null;
  profileAddress?: AddressDto | null;
} = {}) {
  await page.viewport(VIEWPORT.width, VIEWPORT.height);
  const emitted: Footprint[] = [];
  const places = placesStub(opts.geocodeResult ?? null);
  const addressSignal = signal<AddressDto | null>(opts.profileAddress ?? null);
  const profile = profileStub(addressSignal);
  const rendered = await render(MapVoieComponent, {
    providers: [
      { provide: PlacesService, useValue: places },
      { provide: ProfileService, useValue: profile },
    ],
    on: { footprintComputed: (f: Footprint) => emitted.push(f) },
  });
  // Le mode navigateur de vitest partage le `document` : on scope par conteneur (L-013).
  const q = within(rendered.container as HTMLElement);
  return { ...rendered, q, emitted, places, profile, addressSignal };
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

/** Adresse de profil en ONTARIO — province ≠ défaut « QC » pour que l'assertion ait du sens (L-002). */
const ONTARIO_PROFILE: AddressDto = {
  civicNumber: '55',
  street: 'rue Bank',
  apartment: null,
  city: 'Ottawa',
  province: 'ON', // DIFFÈRE du défaut « QC » → prouve que le pré-remplissage écrase bien le défaut.
  postalCode: 'K1P 1A1',
  country: 'Canada',
};

describe('MapVoieComponent — voie « Mesurer sur la carte » (adresse + carte sur la même page)', () => {
  it('expose le combobox d’adresse au-dessus de la carte (id unique mesurer-rue)', async () => {
    const { q } = await setup();
    const combo = q.getByRole('combobox', { name: /rue/i });
    expect(combo).toHaveAttribute('id', 'mesurer-rue');
  });

  it('connecté : pré-remplit l’adresse de profil (province ON ≠ défaut QC) en pristine-only (L-002)', async () => {
    // Adresse profil en Ontario, en ZONE (géocodage proche base) → centrage auto sans avertissement.
    const { q, places, fixture } = await setup({
      profileAddress: ONTARIO_PROFILE,
      geocodeResult: {
        label: '55 rue Bank, Ottawa, ON',
        civicNumber: '55',
        street: 'rue Bank',
        city: 'Ottawa',
        province: 'ON',
        postalCode: null,
        lat: 45.42,
        lng: -75.7,
      },
    });

    // En mode « profile », `app-address-choice` affiche la PASTILLE et MASQUE le formulaire projeté
    // (L-026) : on lit donc la valeur du formulaire réactif sous-jacent (que la recopie force a rempli),
    // pas un `<input>` absent du DOM. La province a bien été écrasée par « ON » — un défaut « QC »
    // n'est pas une saisie utilisateur (L-002). Et la pastille profil est bien rendue (positif, L-009).
    expect(q.getByText(/utiliser une autre adresse/i)).toBeInTheDocument();
    const cmp = fixture.componentInstance as unknown as { form: FormGroup };
    expect(cmp.form.getRawValue()).toMatchObject({ city: 'Ottawa', province: 'ON' });

    // D4 — l'effet d'auto-centrage a géocodé l'adresse de profil pour centrer la carte.
    expect(places.geocode).toHaveBeenCalledWith('55', 'rue Bank', 'Ottawa', 'ON');
    const map = fixture.componentInstance as unknown as { lat(): number | null };
    expect(map.lat()).toBe(45.42);
  });

  it('choix d’une suggestion → centre la carte sur ses lat/lng SANS géocoder (D4)', async () => {
    const user = userEvent.setup();
    // Une suggestion proche de la base (Ottawa) → en zone.
    const places = placesStub();
    places.suggest.mockReturnValue(
      of<PlaceSuggestionDto[]>([
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
      ]),
    );
    await page.viewport(VIEWPORT.width, VIEWPORT.height);
    const rendered = await render(MapVoieComponent, {
      providers: [
        { provide: PlacesService, useValue: places },
        { provide: ProfileService, useValue: profileStub(signal<AddressDto | null>(null)) },
      ],
    });
    const q = within(rendered.container as HTMLElement);
    const cmp = rendered.fixture.componentInstance as unknown as {
      lat(): number | null;
      lng(): number | null;
    };

    const combo = q.getByRole('combobox', { name: /rue/i });
    await user.click(combo);
    await user.keyboard('rue Well');
    await q.findAllByRole('option');
    await user.keyboard('{ArrowDown}{Enter}');

    // lat/lng portés par la suggestion → centrage immédiat, AUCUN géocodage à la sélection.
    expect(places.geocode).not.toHaveBeenCalled();
    expect(cmp.lat()).toBe(45.42);
    expect(cmp.lng()).toBe(-75.7);
  });

  it('« Centrer la carte » : géocode l’adresse saisie et centre la carte (D4)', async () => {
    const user = userEvent.setup();
    const { q, places, fixture } = await setup({
      geocodeResult: {
        label: '123 rue Principale, Gatineau, QC',
        civicNumber: '123',
        street: 'rue Principale',
        city: 'Gatineau',
        province: 'QC',
        postalCode: null,
        lat: 45.48,
        lng: -75.65,
      },
    });
    const cmp = fixture.componentInstance as unknown as {
      lat(): number | null;
      lng(): number | null;
    };

    await fillManual(user, q);
    await user.click(q.getByRole('button', { name: /centrer la carte sur cette adresse/i }));

    expect(places.geocode).toHaveBeenCalledOnce();
    expect(cmp.lat()).toBe(45.48);
    expect(cmp.lng()).toBe(-75.65);
  });

  it('adresse HORS zone → avertissement role="status" NON bloquant (D5)', async () => {
    const user = userEvent.setup();
    // Montréal (~160 km) → hors zone.
    const { q } = await setup({
      geocodeResult: {
        label: '1000 rue Sainte-Catherine, Montréal, QC',
        civicNumber: '1000',
        street: 'rue Sainte-Catherine',
        city: 'Montréal',
        province: 'QC',
        postalCode: null,
        lat: 45.5019,
        lng: -73.5674,
      },
    });

    await fillManual(user, q, 'Montréal');
    await user.click(q.getByRole('button', { name: /centrer la carte sur cette adresse/i }));

    const warning = await q.findByText(/hors de notre zone de livraison/i);
    expect(warning).toBeVisible();
    // NON bloquant : l'avertissement est un statut poli, pas une alerte/erreur bloquante.
    expect(warning).toHaveAttribute('role', 'status');
  });

  it('adresse EN zone → aucun avertissement « hors zone » (assertion négative doublée d’une positive, L-009)', async () => {
    const user = userEvent.setup();
    const { q } = await setup({
      geocodeResult: {
        label: '123 rue Principale, Gatineau, QC',
        civicNumber: '123',
        street: 'rue Principale',
        city: 'Gatineau',
        province: 'QC',
        postalCode: null,
        lat: 45.48,
        lng: -75.65,
      },
    });

    await fillManual(user, q);
    await user.click(q.getByRole('button', { name: /centrer la carte sur cette adresse/i }));

    // Positif : le combobox d'adresse reste rendu (la voie est bien active).
    expect(q.getByRole('combobox', { name: /rue/i })).toBeInTheDocument();
    // Négatif : aucun avertissement « hors zone ».
    expect(q.queryByText(/hors de notre zone de livraison/i)).toBeNull();
  });

  it('mode profil : la pastille a un nom accessible NON vide + aucune violation axe (L-040)', async () => {
    // Connecté avec adresse profil → `app-address-choice` rend la PASTILLE (role="group" étiqueté
    // par `aria-labelledby="mesurer-map-heading"`). On vérifie que le nom accessible est NON vide
    // (la référence n'est PAS pendante, L-040) ET on scanne axe sur CETTE branche — la branche
    // invité (axe par défaut ci-dessous) ne couvre pas la pastille (assertion vacue sinon, L-009).
    const { q, container } = await setup({
      profileAddress: ONTARIO_PROFILE,
      geocodeResult: {
        label: '55 rue Bank, Ottawa, ON',
        civicNumber: '55',
        street: 'rue Bank',
        city: 'Ottawa',
        province: 'ON',
        postalCode: null,
        lat: 45.42,
        lng: -75.7,
      },
    });

    // getByRole avec name /.+/ échoue si le nom accessible du groupe est vide (référence pendante).
    expect(q.getByRole('group', { name: /.+/ })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it('adresse profil livrée APRÈS le rendu (async /auth/me) → l’effet géocode et centre (réactivité signal)', async () => {
    // L'adresse profil n'existe PAS au rendu (invité au départ), puis arrive de façon asynchrone
    // (signal flip). L'effet d'auto-centrage doit RÉAGIR à ce signal — pas seulement à un état
    // synchrone fourni au constructeur (sinon il manquerait le vrai chemin async /auth/me).
    const { places, addressSignal, fixture } = await setup({
      geocodeResult: {
        label: '55 rue Bank, Ottawa, ON',
        civicNumber: '55',
        street: 'rue Bank',
        city: 'Ottawa',
        province: 'ON',
        postalCode: null,
        lat: 45.42,
        lng: -75.7,
      },
    });

    // Au rendu (invité) : aucun géocodage automatique.
    expect(places.geocode).not.toHaveBeenCalled();

    // L'adresse de profil arrive (réponse /auth/me) : le signal change → l'effet se ré-exécute.
    addressSignal.set(ONTARIO_PROFILE);
    fixture.detectChanges();

    expect(places.geocode).toHaveBeenCalledWith('55', 'rue Bank', 'Ottawa', 'ON');
    const map = fixture.componentInstance as unknown as { lat(): number | null };
    expect(map.lat()).toBe(45.42);
  });

  it('ne présente aucune violation WCAG A/AA', async () => {
    const { container } = await setup();
    await expectNoA11yViolations(container);
  });
});
