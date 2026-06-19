import { render, screen, waitFor } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { registerLocaleData } from '@angular/common';
import localeFrCa from '@angular/common/locales/fr-CA';
import { ShelterConfiguratorOverlayComponent } from './shelter-configurator-overlay';
import { ShelterService } from '../../../core/services/shelter.service';
import { CartService } from '../../../core/services/cart.service';
import { ShelterModelDetail, ShelterPrice } from '../../../core/models/shelter.model';
import { expectNoA11yViolations } from '../../../../testing/axe-helper';

// Le configurateur affiche des prix via CurrencyPipe('fr-CA') → données de locale requises.
registerLocaleData(localeFrCa);

const model: ShelterModelDetail = {
  id: 'm1',
  slug: 'simple',
  name: 'Abri simple',
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

const price: ShelterPrice = {
  modelId: 'm1',
  slug: 'simple',
  lengthCm: 600,
  archCount: 0,
  totalPrice: 1200,
};

function shelterStub(overrides: Partial<ShelterService> = {}): Partial<ShelterService> {
  return {
    getModel: () => of(model),
    getPrice: () => of(price),
    ...overrides,
  };
}

async function setup(shelter: Partial<ShelterService> = shelterStub(), cart = new CartService()) {
  const close = vi.fn();
  const added = vi.fn();
  const result = await render(ShelterConfiguratorOverlayComponent, {
    inputs: { slug: 'simple', modelName: 'Abri simple' },
    on: { close, added },
    providers: [
      { provide: ShelterService, useValue: shelter },
      { provide: CartService, useValue: cart },
    ],
  });
  return { ...result, close, added, cart };
}

describe('ShelterConfiguratorOverlayComponent', () => {
  it('rend un dialog modal libellé par le nom du modèle', async () => {
    await setup();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName(/abri simple/i);
  });

  it('place le focus dans le dialogue à l’ouverture (L-006)', async () => {
    await setup();
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('ferme avec la touche Échap (émet close)', async () => {
    const user = userEvent.setup();
    const { close } = await setup();
    await user.keyboard('{Escape}');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('ferme au clic sur le bouton « Fermer » (émet close)', async () => {
    const user = userEvent.setup();
    const { close } = await setup();
    await user.click(screen.getByRole('button', { name: /fermer/i }));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('« Ajouter au panier » appelle cart.addShelter et émet `added` une fois le prix confirmé', async () => {
    const user = userEvent.setup();
    const cart = new CartService();
    const addShelter = vi.spyOn(cart, 'addShelter');
    const { added } = await setup(shelterStub(), cart);

    // Le configurateur applique un debounce 300 ms avant de confirmer le prix serveur : on attend
    // que le bouton passe à `aria-disabled=false` (prix confirmé) avant de cliquer.
    const add = await screen.findByRole('button', { name: /ajouter au panier/i });
    await waitFor(() => expect(add).toHaveAttribute('aria-disabled', 'false'));
    await user.click(add);

    expect(addShelter).toHaveBeenCalledTimes(1);
    expect(addShelter.mock.calls[0][0]).toMatchObject({ slug: 'simple', lengthCm: 600 });
    // L'overlay délègue la fermeture/toast/focus au parent : il émet `added` avec le nom du modèle.
    expect(added).toHaveBeenCalledTimes(1);
    expect(added).toHaveBeenCalledWith('Abri simple');
  });

  it('garde « Ajouter » aria-disabled tant qu’aucun prix n’est confirmé', async () => {
    // getPrice n'émet jamais → aucune configuration confirmée → bouton aria-disabled.
    const { NEVER } = await import('rxjs');
    await setup(shelterStub({ getPrice: () => NEVER }));
    const add = screen.getByRole('button', { name: /ajouter au panier/i });
    expect(add).toHaveAttribute('aria-disabled', 'true');
  });

  it('ne présente aucune violation WCAG A/AA (axe)', async () => {
    const { container } = await setup();
    await screen.findByRole('button', { name: /ajouter au panier/i });
    await expectNoA11yViolations(container);
  });
});
