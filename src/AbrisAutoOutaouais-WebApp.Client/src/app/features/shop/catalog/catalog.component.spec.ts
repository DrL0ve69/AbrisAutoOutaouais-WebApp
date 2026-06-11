import { render, screen } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { registerLocaleData } from '@angular/common';
import localeFrCa from '@angular/common/locales/fr-CA';
import { CatalogComponent } from './catalog';
import { ProductService } from '../../../core/services/product.service';
import { CategoryDto, ProductDto } from '../../../core/models/product.model';
import { expectNoA11yViolations } from '../../../../testing/axe-helper';

// Le catalogue affiche des prix via CurrencyPipe('fr-CA') → données de locale requises.
registerLocaleData(localeFrCa);

const categories: CategoryDto[] = [
  { id: 'c1', name: 'Abris simples', slug: 'abris-simples', productCount: 2 },
  { id: 'c2', name: 'Toiles de remplacement', slug: 'toiles-remplacement', productCount: 1 },
];

const products: ProductDto[] = [
  {
    id: 'p1',
    name: 'Abri simple',
    slug: 'abri-simple',
    description: 'Un abri',
    price: 349,
    rentalPrice: 39,
    stock: 5,
    isAvailable: true,
    categoryName: 'Abris simples',
    imageUrls: [],
  },
];

function page(items: ProductDto[]) {
  return {
    items,
    totalCount: items.length,
    pageNumber: 1,
    pageSize: 50,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  };
}

describe('CatalogComponent', () => {
  it('affiche les catégories et les produits', async () => {
    const serviceStub: Partial<ProductService> = {
      getCategories: () => of(categories),
      getProducts: () => of(page(products)),
    };

    await render(CatalogComponent, {
      providers: [
        provideRouter([]),
        { provide: ProductService, useValue: serviceStub },
      ],
    });

    expect(
      await screen.findByRole('button', { name: /abris simples/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /abri simple/i }),
    ).toBeInTheDocument();
  });

  it('recharge les produits filtrés au clic sur une catégorie', async () => {
    const user = userEvent.setup();
    const getProducts = vi
      .fn()
      .mockReturnValue(of(page(products)));
    const serviceStub: Partial<ProductService> = {
      getCategories: () => of(categories),
      getProducts,
    };

    await render(CatalogComponent, {
      providers: [
        provideRouter([]),
        { provide: ProductService, useValue: serviceStub },
      ],
    });

    await user.click(
      await screen.findByRole('button', { name: /toiles de remplacement/i }),
    );

    expect(getProducts).toHaveBeenLastCalledWith(
      expect.objectContaining({ category: 'toiles-remplacement' }),
    );
  });

  it('ne présente aucune violation WCAG A/AA (axe)', async () => {
    const serviceStub: Partial<ProductService> = {
      getCategories: () => of(categories),
      getProducts: () => of(page(products)),
    };

    const { container } = await render(CatalogComponent, {
      providers: [
        provideRouter([]),
        { provide: ProductService, useValue: serviceStub },
      ],
    });

    await expectNoA11yViolations(container);
  });
});
