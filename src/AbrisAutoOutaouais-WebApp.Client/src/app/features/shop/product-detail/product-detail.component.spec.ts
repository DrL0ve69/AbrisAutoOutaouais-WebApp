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
};

async function setup() {
  const result = await render(ProductDetailComponent, {
    inputs: { slug: 'abri-simple' },
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  });
  const http = TestBed.inject(HttpTestingController);
  return { ...result, http };
}

describe('ProductDetailComponent', () => {
  it('affiche le produit une fois chargé (h1 = nom)', async () => {
    const { http } = await setup();
    http.expectOne(`${environment.apiUrl}/products/abri-simple`).flush(product);

    expect(
      await screen.findByRole('heading', { level: 1, name: /abri simple/i }),
    ).toBeInTheDocument();
    http.verify();
  });

  it('affiche « Produit introuvable » sur une erreur 404', async () => {
    const { http } = await setup();
    http
      .expectOne(`${environment.apiUrl}/products/abri-simple`)
      .flush('Not found', { status: 404, statusText: 'Not Found' });

    expect(await screen.findByText(/produit introuvable/i)).toBeInTheDocument();
    http.verify();
  });

  it('ne présente aucune violation WCAG A/AA (axe)', async () => {
    const { http, container } = await setup();
    http.expectOne(`${environment.apiUrl}/products/abri-simple`).flush(product);
    await screen.findByRole('heading', { level: 1, name: /abri simple/i });

    await expectNoA11yViolations(container);
    http.verify();
  });
});
