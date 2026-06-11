import { render, screen } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { registerLocaleData } from '@angular/common';
import localeFrCa from '@angular/common/locales/fr-CA';
import { ProductCardComponent } from './product-card';
import { ProductSummaryDto } from '../../../core/models/product.model';
import { expectNoA11yViolations } from '../../../../testing/axe-helper';

// La carte affiche des prix via CurrencyPipe('fr-CA') → données de locale requises.
registerLocaleData(localeFrCa);

const product: ProductSummaryDto = {
  id: '1',
  name: 'Abri simple',
  slug: 'abri-simple',
  price: 349,
  rentalPrice: 39,
  isAvailable: true,
  categoryName: 'Abris simples',
  thumbnailUrl: null,
};

describe('ProductCardComponent', () => {
  it('affiche le nom et la catégorie du produit', async () => {
    await render(ProductCardComponent, {
      inputs: { product },
      providers: [provideRouter([])],
    });

    expect(
      screen.getByRole('heading', { name: /abri simple/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Abris simples')).toBeInTheDocument();
  });

  it('émet addToCart avec le produit au clic sur le bouton', async () => {
    const user = userEvent.setup();
    const addToCart = vi.fn();

    await render(ProductCardComponent, {
      inputs: { product },
      on: { addToCart },
      providers: [provideRouter([])],
    });

    await user.click(screen.getByRole('button', { name: /ajouter au panier/i }));

    expect(addToCart).toHaveBeenCalledWith(product);
  });

  it('désactive le bouton quand le produit est indisponible', async () => {
    await render(ProductCardComponent, {
      inputs: { product: { ...product, isAvailable: false } },
      providers: [provideRouter([])],
    });

    expect(
      screen.getByRole('button', { name: /ajouter au panier/i }),
    ).toBeDisabled();
  });

  it('ne présente aucune violation WCAG A/AA (axe)', async () => {
    const { container } = await render(ProductCardComponent, {
      inputs: { product },
      providers: [provideRouter([])],
    });

    await expectNoA11yViolations(container);
  });
});
