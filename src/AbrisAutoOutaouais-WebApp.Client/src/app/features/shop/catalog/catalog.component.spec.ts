import { render, screen } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { NEVER, of, throwError } from 'rxjs';
import { registerLocaleData } from '@angular/common';
import localeFrCa from '@angular/common/locales/fr-CA';
import { CatalogComponent } from './catalog';
import { ProductService } from '../../../core/services/product.service';
import { ShelterService } from '../../../core/services/shelter.service';
import { CategoryDto, ProductDto } from '../../../core/models/product.model';
import { ShelterModelDetail, ShelterModelSummary } from '../../../core/models/shelter.model';
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
    widthCm: null,
    lengthCm: null,
    heightCm: null,
    brand: null,
    model: null,
  },
];

const shelterModels: ShelterModelSummary[] = [
  {
    id: 'm1',
    slug: 'simple',
    name: 'Abri simple paramétrique',
    categoryName: 'Abris simples',
    basePrice: 1200,
    minLengthCm: 600,
    maxLengthCm: 900,
    lengthStepCm: 150,
  },
];

const shelterModelDetail: ShelterModelDetail = {
  ...shelterModels[0],
  categoryId: 'c1',
  pricePerArchCents: 25000,
  widthOptionsCm: [335],
  clearHeightOptionsCm: [198, 244],
};

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

function defaultProductStub(): Partial<ProductService> {
  return {
    getCategories: () => of(categories),
    getProducts: () => of(page(products)),
  };
}

async function setup(
  productStub: Partial<ProductService> = defaultProductStub(),
  shelterStub: Partial<ShelterService> = { getModels: () => of(shelterModels) },
) {
  return render(CatalogComponent, {
    providers: [
      provideRouter([]),
      { provide: ProductService, useValue: productStub },
      { provide: ShelterService, useValue: shelterStub },
    ],
  });
}

describe('CatalogComponent', () => {
  it('affiche les catégories et les produits', async () => {
    await setup();

    expect(
      await screen.findByRole('button', { name: /abris simples/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /abri simple/i }),
    ).toBeInTheDocument();
  });

  it('recharge les produits filtrés au clic sur une catégorie NON paramétrique', async () => {
    const user = userEvent.setup();
    const getProducts = vi.fn().mockReturnValue(of(page(products)));
    await setup({ getCategories: () => of(categories), getProducts });

    await user.click(
      await screen.findByRole('button', { name: /toiles de remplacement/i }),
    );

    expect(getProducts).toHaveBeenLastCalledWith(
      expect.objectContaining({ category: 'toiles-remplacement' }),
    );
  });

  it("catégorie paramétrique → cartes de modèles + bouton qui ouvre l'overlay", async () => {
    const user = userEvent.setup();
    const getModels = vi.fn().mockReturnValue(of(shelterModels));
    // L'overlay monte le configurateur, qui charge le détail du modèle + le prix.
    await setup(defaultProductStub(), {
      getModels,
      getModel: () => of(shelterModelDetail),
      getPrice: () => NEVER,
    });

    await user.click(await screen.findByRole('button', { name: /abris simples/i }));

    // Les modèles sont chargés pour la catégorie active.
    expect(getModels).toHaveBeenCalledWith('abris-simples');
    // La carte de modèle s'affiche (h2 = nom du modèle).
    expect(
      await screen.findByRole('heading', { level: 2, name: /abri simple paramétrique/i }),
    ).toBeInTheDocument();

    // Le bouton « Ajouter au panier » de la carte ouvre l'overlay (role=dialog).
    await user.click(
      screen.getByRole('button', { name: /ajouter au panier.*abri simple paramétrique/i }),
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it("catégorie paramétrique : getModels en erreur → message d'indisponibilité (pas de crash)", async () => {
    const user = userEvent.setup();
    await setup(defaultProductStub(), {
      getModels: () => throwError(() => new Error('boom')),
    });

    await user.click(await screen.findByRole('button', { name: /abris simples/i }));

    expect(
      await screen.findByText(/momentanément indisponibles/i),
    ).toBeInTheDocument();
  });

  it("annonce le chargement sans violation axe (grille role=status)", async () => {
    const { container } = await setup({
      getCategories: () => of(categories),
      getProducts: () => NEVER,
    });

    const loadingGrid = container.querySelector('.catalog__grid[aria-busy="true"]');
    expect(loadingGrid).not.toBeNull();
    expect(loadingGrid).toHaveAttribute('role', 'status');
    await expectNoA11yViolations(container);
  });

  it('ne présente aucune violation WCAG A/AA (axe)', async () => {
    const { container } = await setup();
    await screen.findByRole('heading', { name: /abri simple/i });
    await expectNoA11yViolations(container);
  });
});
