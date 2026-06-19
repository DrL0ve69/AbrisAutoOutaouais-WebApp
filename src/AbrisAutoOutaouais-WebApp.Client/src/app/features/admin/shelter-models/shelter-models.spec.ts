import { render, screen, within, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { registerLocaleData } from '@angular/common';
import localeFrCa from '@angular/common/locales/fr-CA';
import {
  AdminShelterModelsComponent,
  parseCmList,
  atLeastOnePositiveInteger,
} from './shelter-models';
import { CategoryDto } from '../../../core/models/product.model';
import {
  CreateShelterModelRequest,
  ShelterModelDetail,
  ShelterModelSummary,
} from '../../../core/models/shelter.model';
import { environment } from '../../../../environments/environment';
import { expectNoA11yViolations } from '../../../../testing/axe-helper';
import { FormControl } from '@angular/forms';

registerLocaleData(localeFrCa);

const categories: CategoryDto[] = [
  { id: 'cat-1', name: 'Abris simples', slug: 'abris-simples', productCount: 0 },
];

const model: ShelterModelSummary = {
  id: 'm-1',
  slug: 'abri-simple',
  name: 'Abri simple',
  categoryName: 'Abris simples',
  basePrice: 349,
  minLengthCm: 122,
  maxLengthCm: 1830,
  lengthStepCm: 122,
};

const detail: ShelterModelDetail = {
  ...model,
  // Le détail porte le categoryId (Guid) : l'édition résout la catégorie PAR ID, pas par nom.
  categoryId: 'cat-1',
  pricePerArchCents: 15000,
  widthOptionsCm: [335, 366],
  clearHeightOptionsCm: [198],
};

/** Monte le composant et vide les requêtes du constructeur (catégories + liste /shelters). */
async function setup(list: ShelterModelSummary[] = []) {
  const result = await render(AdminShelterModelsComponent, {
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne(`${environment.apiUrl}/categories`).flush(categories);
  http.expectOne(req => req.url === `${environment.apiUrl}/shelters`).flush(list);
  result.detectChanges();
  return { ...result, http };
}

describe('parseCmList', () => {
  it('découpe, trim et convertit en nombres', () => {
    expect(parseCmList('244, 305, 366')).toEqual([244, 305, 366]);
  });
  it('écarte les segments vides et non numériques', () => {
    expect(parseCmList('244, , abc, 305')).toEqual([244, 305]);
  });
  it('renvoie un tableau vide pour une saisie vide', () => {
    expect(parseCmList('   ')).toEqual([]);
  });
});

describe('atLeastOnePositiveInteger', () => {
  it('valide une liste d’entiers positifs', () => {
    expect(atLeastOnePositiveInteger(new FormControl('244, 305'))).toBeNull();
  });
  it('rejette une liste vide (required)', () => {
    expect(atLeastOnePositiveInteger(new FormControl(''))).toEqual({ required: true });
  });
  it('rejette une valeur ≤ 0 (positiveIntegers)', () => {
    expect(atLeastOnePositiveInteger(new FormControl('244, 0'))).toEqual({ positiveIntegers: true });
  });
  it('rejette une valeur décimale (positiveIntegers)', () => {
    expect(atLeastOnePositiveInteger(new FormControl('244.5'))).toEqual({ positiveIntegers: true });
  });
});

describe('AdminShelterModelsComponent — création', () => {
  it('envoie un payload de création complet (listes parsées, prix/arche en cents)', async () => {
    const { http } = await setup();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/identifiant \(slug\)/i), 'abri-tempo');
    await user.type(screen.getByLabelText(/^nom$/i), 'Abri Tempo');
    await user.selectOptions(screen.getByLabelText(/catégorie/i), 'cat-1');
    await user.clear(screen.getByLabelText(/prix de base/i));
    await user.type(screen.getByLabelText(/prix de base/i), '349');
    await user.clear(screen.getByLabelText(/prix par arche/i));
    await user.type(screen.getByLabelText(/prix par arche/i), '15000');
    await user.type(screen.getByLabelText(/largeurs proposées/i), '244, 305, 366');
    await user.type(screen.getByLabelText(/hauteurs dégagées/i), '198, 213');

    await user.click(screen.getByRole('button', { name: /créer le modèle/i }));

    const req = http.expectOne(`${environment.apiUrl}/shelters`);
    expect(req.request.method).toBe('POST');
    const body = req.request.body as CreateShelterModelRequest;
    expect(body.slug).toBe('abri-tempo');
    expect(body.pricePerArchCents).toBe(15000);
    expect(body.widthsCm).toEqual([244, 305, 366]);
    expect(body.clearHeightsCm).toEqual([198, 213]);
    req.flush({ id: 'new-id' });

    http.expectOne(req2 => req2.url === `${environment.apiUrl}/shelters`).flush([]);
    http.verify();
  });

  it('affiche une erreur quand la largeur est vide (au moins une requise)', async () => {
    const { http } = await setup();
    const user = userEvent.setup();

    const widths = screen.getByLabelText(/largeurs proposées/i);
    await user.click(widths);
    await user.tab();

    expect(await screen.findByText(/au moins une largeur/i)).toBeInTheDocument();
    expect(widths).toHaveAttribute('aria-invalid', 'true');
    http.verify();
  });

  it('signale min ≥ max sous le champ longueur max', async () => {
    const { http } = await setup();
    const user = userEvent.setup();

    const min = screen.getByLabelText(/longueur min/i);
    const max = screen.getByLabelText(/longueur max/i);
    await user.clear(min);
    await user.type(min, '1830');
    await user.clear(max);
    await user.type(max, '1830');
    await user.tab();

    expect(await screen.findByText(/supérieure à la minimale/i)).toBeInTheDocument();
    http.verify();
  });

  it('ne présente aucune violation WCAG A/AA (axe)', async () => {
    const { http, container } = await setup([model]);
    await expectNoA11yViolations(container);
    http.verify();
  });
});

describe('AdminShelterModelsComponent — édition (slug immuable)', () => {
  it('charge le détail, affiche le slug en lecture seule et ne l’envoie pas au PUT', async () => {
    const { http } = await setup([model]);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /modifier abri simple/i }));
    // Le clic « Modifier » charge le détail du modèle.
    http
      .expectOne(`${environment.apiUrl}/shelters/${encodeURIComponent('abri-simple')}`)
      .flush(detail);

    // Le slug n'est plus un champ de saisie : il n'y a pas de <input> pour le slug en édition.
    expect(screen.queryByLabelText(/identifiant \(slug\)/i)).not.toBeInTheDocument();
    expect(screen.getByText('abri-simple')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    const put = http.expectOne(`${environment.apiUrl}/shelters/m-1`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).not.toHaveProperty('slug');
    expect(put.request.body.name).toBe('Abri simple');
    // La catégorie est bindée PAR ID depuis le détail (et non re-résolue par nom).
    expect(put.request.body.categoryId).toBe('cat-1');
    expect(put.request.body.pricePerArchCents).toBe(15000);
    put.flush(null);

    http.expectOne(req => req.url === `${environment.apiUrl}/shelters`).flush([]);
    http.verify();
  });
});

// Gestion du focus du dialogue de suppression (WCAG 2.4.3 / APG modal) — parité admin/products,
// on asserte le focus réel (L-006), pas seulement le role.
describe('AdminShelterModelsComponent — focus du dialogue de suppression', () => {
  it('déplace le focus dans la boîte de dialogue à l’ouverture', async () => {
    const { http } = await setup([model]);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /supprimer abri simple/i }));

    const dialog = await screen.findByRole('alertdialog');
    await waitFor(() => expect(dialog).toHaveFocus());
    http.verify();
  });

  it('referme sans supprimer et rend le focus au déclencheur', async () => {
    const { http } = await setup([model]);
    const user = userEvent.setup();

    const trigger = await screen.findByRole('button', { name: /supprimer abri simple/i });
    await user.click(trigger);
    await screen.findByRole('alertdialog');

    await user.click(screen.getByRole('button', { name: /^annuler$/i }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    http.verify();
  });

  it('supprime après confirmation et déplace le focus au titre de la liste', async () => {
    const { http } = await setup([model]);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /supprimer abri simple/i }));
    const dialog = await screen.findByRole('alertdialog');

    await user.click(within(dialog).getByRole('button', { name: /supprimer/i }));

    http
      .expectOne(req => req.method === 'DELETE' && req.url === `${environment.apiUrl}/shelters/m-1`)
      .flush(null);
    http.expectOne(req => req.url === `${environment.apiUrl}/shelters`).flush([]);

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /modèles du référentiel/i })).toHaveFocus(),
    );
    http.verify();
  });
});
