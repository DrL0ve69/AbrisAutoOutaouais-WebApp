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
import { AdminProductsComponent } from './products';
import { CategoryDto, CreateProductRequest } from '../../../core/models/product.model';
import { environment } from '../../../../environments/environment';
import { expectNoA11yViolations } from '../../../../testing/axe-helper';

registerLocaleData(localeFrCa);

const categories: CategoryDto[] = [
  { id: 'cat-1', name: 'Abris simples', slug: 'abris-simples', productCount: 0 },
];

const emptyPage = {
  items: [],
  totalCount: 0,
  pageNumber: 1,
  pageSize: 100,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
};

/** Produit unique pour exercer la suppression (ligne + bouton déclencheur). */
const product = {
  id: 'p-1',
  name: 'Abri Test',
  slug: 'abri-test',
  price: 599,
  rentalPrice: null,
  isAvailable: true,
  categoryName: 'Abris simples',
  thumbnailUrl: null,
  description: null,
  stock: 4,
  imageUrls: [],
  widthCm: null,
  lengthCm: null,
  heightCm: null,
  brand: null,
  model: null,
};

const pageWithProduct = { ...emptyPage, items: [product], totalCount: 1, totalPages: 1 };

/**
 * Monte le composant et vide les deux requêtes déclenchées au constructeur
 * (catégories + liste paginée), afin que le formulaire soit prêt.
 */
async function setup(list: typeof emptyPage = emptyPage) {
  const result = await render(AdminProductsComponent, {
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne(`${environment.apiUrl}/categories`).flush(categories);
  http.expectOne(req => req.url === `${environment.apiUrl}/products`).flush(list);
  // Le flush met à jour les signaux APRÈS le rendu initial : on déclenche la détection
  // de changements pour que la liste (@for) soit peinte avant les requêtes du test.
  result.detectChanges();
  return { ...result, http };
}

describe('AdminProductsComponent — dimensions', () => {
  it('envoie les 3 dimensions saisies dans la charge utile de création', async () => {
    const { http } = await setup();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^nom$/i), 'Abri Mesuré');
    await user.type(screen.getByLabelText(/description/i), 'Un abri dimensionné');
    await user.clear(screen.getByLabelText(/prix/i));
    await user.type(screen.getByLabelText(/prix/i), '499.99');
    await user.clear(screen.getByLabelText(/^stock$/i));
    await user.type(screen.getByLabelText(/^stock$/i), '3');
    await user.selectOptions(screen.getByLabelText(/catégorie/i), 'cat-1');

    // Valeurs non triviales (≠ défaut null) pour que l'assertion ait du sens (L-002).
    await user.type(screen.getByLabelText(/largeur/i), '335');
    await user.type(screen.getByLabelText(/longueur/i), '488');
    await user.type(screen.getByLabelText(/hauteur/i), '244');

    await user.click(screen.getByRole('button', { name: /créer le produit/i }));

    const req = http.expectOne(`${environment.apiUrl}/products`);
    const body = req.request.body as CreateProductRequest;
    expect(body.widthCm).toBe(335);
    expect(body.lengthCm).toBe(488);
    expect(body.heightCm).toBe(244);
    req.flush({ id: 'new-id' });

    // Le rechargement de la liste suit le succès.
    http.expectOne(req2 => req2.url === `${environment.apiUrl}/products`).flush(emptyPage);
    http.verify();
  });

  it('laisse les dimensions à null quand les champs sont vides', async () => {
    const { http } = await setup();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^nom$/i), 'Accessoire');
    await user.type(screen.getByLabelText(/description/i), 'Sans dimensions');
    await user.clear(screen.getByLabelText(/prix/i));
    await user.type(screen.getByLabelText(/prix/i), '19');
    await user.clear(screen.getByLabelText(/^stock$/i));
    await user.type(screen.getByLabelText(/^stock$/i), '50');
    await user.selectOptions(screen.getByLabelText(/catégorie/i), 'cat-1');

    await user.click(screen.getByRole('button', { name: /créer le produit/i }));

    const req = http.expectOne(`${environment.apiUrl}/products`);
    const body = req.request.body as CreateProductRequest;
    expect(body.widthCm).toBeNull();
    expect(body.lengthCm).toBeNull();
    expect(body.heightCm).toBeNull();
    req.flush({ id: 'new-id' });

    http.expectOne(req2 => req2.url === `${environment.apiUrl}/products`).flush(emptyPage);
    http.verify();
  });

  it('affiche un message d’erreur pour une dimension hors plage (50–2000)', async () => {
    const { http } = await setup();
    const user = userEvent.setup();

    const width = screen.getByLabelText(/largeur/i);
    await user.type(width, '10'); // < 50
    await user.tab(); // marque le contrôle « touched »

    expect(await screen.findByText(/comprise entre 50 et 2000/i)).toBeInTheDocument();
    expect(width).toHaveAttribute('aria-invalid', 'true');
    http.verify();
  });

  it('ne présente aucune violation WCAG A/AA (axe)', async () => {
    const { http, container } = await setup();

    await expectNoA11yViolations(container);
    http.verify();
  });
});

// Gestion du focus du dialogue de suppression (WCAG 2.4.3 / APG modal) — parité avec
// admin/bookings et admin/rentals (F2-A). Un statut/role-only ne suffit pas : on asserte
// le focus réel (L-006).
describe('AdminProductsComponent — focus du dialogue de suppression', () => {
  it('déplace le focus dans la boîte de dialogue à l’ouverture', async () => {
    const { http } = await setup(pageWithProduct);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /supprimer abri test/i }));

    const dialog = await screen.findByRole('alertdialog');
    await waitFor(() => expect(dialog).toHaveFocus());
    http.verify();
  });

  it('referme la confirmation sans supprimer et rend le focus au déclencheur', async () => {
    const { http } = await setup(pageWithProduct);
    const user = userEvent.setup();

    const trigger = await screen.findByRole("button", { name: /supprimer abri test/i });
    await user.click(trigger);
    await screen.findByRole('alertdialog');

    await user.click(screen.getByRole('button', { name: /^annuler$/i }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    http.verify();
  });

  it('supprime après confirmation et déplace le focus au titre de la liste (déclencheur retiré)', async () => {
    const { http } = await setup(pageWithProduct);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /supprimer abri test/i }));
    const dialog = await screen.findByRole('alertdialog');

    // Bouton « Supprimer » DU DIALOGUE (scopé pour ne pas viser celui de la ligne).
    await user.click(within(dialog).getByRole('button', { name: /supprimer/i }));

    http
      .expectOne(req => req.method === 'DELETE' && req.url === `${environment.apiUrl}/products/p-1`)
      .flush(null);
    // Le succès recharge la liste (déclencheur retiré du DOM).
    http.expectOne(req => req.url === `${environment.apiUrl}/products`).flush(emptyPage);

    // Le focus revient sur le titre de la liste APRÈS le rendu (L-006).
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /produits du catalogue/i })).toHaveFocus(),
    );
    http.verify();
  });
});
