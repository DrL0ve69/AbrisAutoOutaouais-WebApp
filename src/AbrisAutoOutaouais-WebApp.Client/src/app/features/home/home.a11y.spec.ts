import { render } from '@testing-library/angular';
import { describe, it } from 'vitest';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localeFrCa from '@angular/common/locales/fr-CA';
import { HomeComponent } from './home';
import { ProductService } from '../../core/services/product.service';
import { CategoryDto, ProductDto } from '../../core/models/product.model';
import { expectNoA11yViolations } from '../../../testing/axe-helper';

registerLocaleData(localeFrCa);

const categories: CategoryDto[] = [
  { id: 'c1', name: 'Abris simples', slug: 'abris-simples', productCount: 1 },
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
    widthCm: null,
    lengthCm: null,
    heightCm: null,
    brand: null,
    model: null,
  },
];

const page = {
  items: products,
  totalCount: 1,
  pageNumber: 1,
  pageSize: 50,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
};

describe('HomeComponent (accessibilité)', () => {
  it('ne présente aucune violation WCAG A/AA (axe)', async () => {
    const stub: Partial<ProductService> = {
      getCategories: () => of(categories),
      getProducts: () => of(page),
    };

    const { container } = await render(HomeComponent, {
      providers: [
        provideRouter([]),
        { provide: ProductService, useValue: stub },
      ],
    });

    await expectNoA11yViolations(container);
  });
});
