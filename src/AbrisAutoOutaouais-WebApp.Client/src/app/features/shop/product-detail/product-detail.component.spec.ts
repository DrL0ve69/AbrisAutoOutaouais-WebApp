import { render, screen } from '@testing-library/angular';
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
import { ProductDetailComponent } from './product-detail';
import { ProductDto } from '../../../core/models/product.model';
import { ShelterModelDetail } from '../../../core/models/shelter.model';
import { environment } from '../../../../environments/environment';
import { expectNoA11yViolations } from '../../../../testing/axe-helper';

registerLocaleData(localeFrCa);

const product: ProductDto = {
  id: 'p1',
  name: 'Abri simple',
  slug: 'abri-simple',
  description: 'Un abri robuste',
  price: 349,
  rentalPrice: 39,
  stock: 5,
  isAvailable: true,
  categoryName: 'Abris simples',
  imageUrls: [],
  widthCm: 335,
  lengthCm: 488,
  heightCm: 244,
  brand: 'Abris Tempo',
  model: 'Tempo Auto 11x16',
};

const shelterModel: ShelterModelDetail = {
  id: 'm1',
  slug: 'simple',
  name: 'Abri simple paramétrique',
  categoryName: 'Abris simples',
  categoryId: 'c1',
  basePrice: 1200,
  minLengthCm: 600,
  maxLengthCm: 900,
  lengthStepCm: 150,
  pricePerArchCents: 25000,
  widthOptionsCm: [335],
  clearHeightOptionsCm: [198, 244],
};

async function setup(slug: string) {
  const result = await render(ProductDetailComponent, {
    inputs: { slug },
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  });
  const http = TestBed.inject(HttpTestingController);
  return { ...result, http };
}

/** Réponse 404 du modèle paramétrique → la fiche se rabat sur le produit fixe. */
function failShelter(http: HttpTestingController, slug: string): void {
  http
    .expectOne(`${environment.apiUrl}/shelters/${slug}`)
    .flush('Not found', { status: 404, statusText: 'Not Found' });
}

describe('ProductDetailComponent — produit fixe (repli)', () => {
  it('affiche le produit une fois chargé (h1 = nom)', async () => {
    const { http } = await setup('abri-simple');
    failShelter(http, 'abri-simple');
    http.expectOne(`${environment.apiUrl}/products/abri-simple`).flush(product);

    expect(
      await screen.findByRole('heading', { level: 1, name: /abri simple/i }),
    ).toBeInTheDocument();
    http.verify();
  });

  it('affiche « Produit introuvable » sur une erreur 404 produit', async () => {
    const { http } = await setup('abri-simple');
    failShelter(http, 'abri-simple');
    http
      .expectOne(`${environment.apiUrl}/products/abri-simple`)
      .flush('Not found', { status: 404, statusText: 'Not Found' });

    expect(await screen.findByText(/produit introuvable/i)).toBeInTheDocument();
    http.verify();
  });

  it('ne présente aucune violation WCAG A/AA (axe)', async () => {
    const { http, container } = await setup('abri-simple');
    failShelter(http, 'abri-simple');
    http.expectOne(`${environment.apiUrl}/products/abri-simple`).flush(product);
    await screen.findByRole('heading', { level: 1, name: /abri simple/i });

    await expectNoA11yViolations(container);
    http.verify();
  });

  it('propose « Voir en 3D » quand les 3 dimensions sont présentes', async () => {
    const { http } = await setup('abri-simple');
    failShelter(http, 'abri-simple');
    http.expectOne(`${environment.apiUrl}/products/abri-simple`).flush(product);
    await screen.findByRole('heading', { level: 1, name: /abri simple/i });

    expect(
      await screen.findByRole('button', { name: /voir en 3d/i }),
    ).toBeInTheDocument();
    http.verify();
  });

  it('masque « Voir en 3D » si une dimension est nulle', async () => {
    const { http } = await setup('abri-simple');
    failShelter(http, 'abri-simple');
    http
      .expectOne(`${environment.apiUrl}/products/abri-simple`)
      .flush({ ...product, heightCm: null });
    await screen.findByRole('heading', { level: 1, name: /abri simple/i });

    expect(screen.queryByRole('button', { name: /voir en 3d/i })).not.toBeInTheDocument();
    http.verify();
  });
});

describe('ProductDetailComponent — modèle paramétrique (configurateur inline)', () => {
  /**
   * Flush le 1er `/shelters/:slug` (résolution de la fiche), puis — une fois le configurateur monté
   * (`@case('shelter')`) — flush sa propre requête `/shelters/:slug` (chargement du détail). La 2ᵉ
   * requête n'est émise qu'APRÈS le rendu du configurateur, d'où le `findByRole` intermédiaire.
   */
  async function resolveShelter(http: HttpTestingController): Promise<void> {
    http.expectOne(`${environment.apiUrl}/shelters/simple`).flush(shelterModel);
    await screen.findByRole('heading', { level: 1, name: /abri simple paramétrique/i });
    // Le configurateur inline charge à son tour le détail du modèle.
    const configReq = http.expectOne(`${environment.apiUrl}/shelters/simple`);
    configReq.flush(shelterModel);
  }

  it('rend le configurateur EN LIGNE quand le slug résout un modèle', async () => {
    const { http } = await setup('simple');
    await resolveShelter(http);

    expect(
      screen.getByRole('heading', { level: 1, name: /abri simple paramétrique/i }),
    ).toBeInTheDocument();
    // Le configurateur expose la légende « Longueur » (radiogroup/select).
    expect(await screen.findByText(/longueur/i)).toBeInTheDocument();
  });

  it('garde « Ajouter au panier » aria-disabled tant que le prix n’est pas confirmé', async () => {
    const { http } = await setup('simple');
    await resolveShelter(http);

    // Aucune réponse /price flushée (le debounce 300 ms du configurateur n'a pas confirmé de
    // prix) → bouton FOCUSABLE mais aria-disabled (L-024).
    const add = await screen.findByRole('button', { name: /ajouter au panier/i });
    expect(add).toHaveAttribute('aria-disabled', 'true');
  });
});
