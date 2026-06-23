import { render, screen } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { registerLocaleData } from '@angular/common';
import localeFrCa from '@angular/common/locales/fr-CA';
import { ShelterModelCardComponent, ShelterConfigureRequest } from './shelter-model-card';
import { ShelterModelSummary } from '../../../core/models/shelter.model';
import { expectNoA11yViolations } from '../../../../testing/axe-helper';

registerLocaleData(localeFrCa);

const model: ShelterModelSummary = {
  id: 'm1',
  slug: 'simple',
  name: 'Abri simple paramétrique',
  categoryName: 'Abris simples',
  basePrice: 1200,
  minLengthCm: 600,
  maxLengthCm: 900,
  lengthStepCm: 150,
};

describe('ShelterModelCardComponent', () => {
  it('affiche le nom (h2) et le prix « à partir de »', async () => {
    await render(ShelterModelCardComponent, { inputs: { model } });

    expect(
      screen.getByRole('heading', { level: 2, name: /abri simple paramétrique/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/à partir de/i)).toBeInTheDocument();
  });

  it('illustre la carte par une image de CATÉGORIE (décorative : alt vide) — jamais vide', async () => {
    const { container } = await render(ShelterModelCardComponent, { inputs: { model } });

    const img = container.querySelector<HTMLImageElement>('img.model-card__image');
    expect(img).not.toBeNull();
    // Image résolue par la catégorie (« Abris simples » → slug abris-simples) — pas de carte vide.
    expect(img!.getAttribute('src')).toBe('/images/categories/abris-simples.svg');
    // Décorative : le nom est déjà annoncé par le titre, donc alt vide (pas de doublon — WCAG 1.1.1).
    expect(img!.getAttribute('alt')).toBe('');
  });

  it('retombe sur un visuel par défaut quand la catégorie est inconnue (carte jamais vide — L-040)', async () => {
    const { container } = await render(ShelterModelCardComponent, {
      inputs: { model: { ...model, categoryName: 'Catégorie inexistante' } },
    });

    const img = container.querySelector<HTMLImageElement>('img.model-card__image');
    expect(img!.getAttribute('src')).toBe('/images/categories/abris-simples.svg');
  });

  it('émet configure (slug + nom + déclencheur) au clic sur « Ajouter au panier »', async () => {
    const user = userEvent.setup();
    const configure = vi.fn<(r: ShelterConfigureRequest) => void>();
    await render(ShelterModelCardComponent, {
      inputs: { model },
      on: { configure },
    });

    const btn = screen.getByRole('button', { name: /ajouter au panier/i });
    await user.click(btn);

    expect(configure).toHaveBeenCalledTimes(1);
    const req = configure.mock.calls[0][0];
    expect(req.slug).toBe('simple');
    expect(req.modelName).toBe('Abri simple paramétrique');
    // Le déclencheur transmis EST le bouton cliqué (retour de focus à la fermeture — L-006).
    expect(req.trigger).toBe(btn);
  });

  it('ne présente aucune violation WCAG A/AA (axe)', async () => {
    const { container } = await render(ShelterModelCardComponent, { inputs: { model } });
    await expectNoA11yViolations(container);
  });
});
