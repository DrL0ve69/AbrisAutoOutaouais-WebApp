import { render, screen, within } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localeFrCa from '@angular/common/locales/fr-CA';
import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { ConseilStepComponent } from './conseil-step';
import { ShelterSuggestionService } from '../../../../core/services/shelter-suggestion.service';
import { ShelterFitResult } from '../../../../core/models/shelter-fit.model';
import { Footprint } from '../../util/footprint.util';
import { expectNoA11yViolations } from '../../../../../testing/axe-helper';

registerLocaleData(localeFrCa);

const RESULTS: ShelterFitResult[] = [
  {
    categorySlug: 'abris-simples',
    categoryName: 'Abris simples',
    categoryMaxWidthCm: 366,
    models: [
      {
        id: 'm1',
        slug: 'simple-11pi',
        name: 'Abri simple 11 pi',
        widthCm: 335,
        basePrice: 1099,
        minLengthCm: 488,
        lengthStepCm: 122,
        availableLengthsCm: [488, 610, 732],
      },
    ],
  },
  {
    categorySlug: 'abris-doubles',
    categoryName: 'Abris doubles',
    categoryMaxWidthCm: 488,
    models: [
      {
        id: 'm2',
        slug: 'double-pointu-16pi',
        name: 'Abri double pointu 16 pi',
        widthCm: 488,
        basePrice: 1899,
        minLengthCm: 488,
        lengthStepCm: 122,
        availableLengthsCm: [488, 610],
      },
    ],
  },
];

const FOOTPRINT: Footprint = { widthCm: 488, lengthCm: 914, outOfRange: false };

async function setup(results: ShelterFitResult[]) {
  const service: Partial<ShelterSuggestionService> = {
    suggestModels: vi.fn().mockReturnValue(of(results)),
  };
  const rendered = await render(ConseilStepComponent, {
    inputs: { footprint: FOOTPRINT },
    providers: [provideRouter([]), { provide: ShelterSuggestionService, useValue: service }],
  });
  return { ...rendered, service };
}

describe('ConseilStepComponent', () => {
  it('appelle suggestModels avec le gabarit et rend une section par catégorie', async () => {
    const { service } = await setup(RESULTS);
    expect(service.suggestModels).toHaveBeenCalledWith(488, 914);
    expect(await screen.findByRole('heading', { name: 'Abris simples' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Abris doubles' })).toBeInTheDocument();
  });

  it('affiche chaque modèle avec ses longueurs admissibles (en pieds)', async () => {
    await setup(RESULTS);
    // Scopé à la carte du modèle simple (deux catégories portent un texte « longueurs offertes »).
    const simpleCard = (await screen.findByRole('heading', { name: 'Abri simple 11 pi' })).closest('li')!;
    const lengths = within(simpleCard).getByText(/longueurs offertes/i);
    // 488 cm → 16,0 pi ; 610 → 20,0 ; 732 → 24,0.
    expect(lengths.textContent).toMatch(/16,0/);
    expect(lengths.textContent).toMatch(/24,0/);
  });

  it('lie « Configurer » au catalogue avec les bons queryParams (catégorie, slug, longueur max)', async () => {
    await setup(RESULTS);
    const link = (await screen.findAllByRole('link', { name: /configurer le modèle abri simple 11 pi/i }))[0];
    // Plus grande longueur admissible = 732 cm.
    expect(link).toHaveAttribute(
      'href',
      '/boutique?category=abris-simples&configure=simple-11pi&length=732',
    );
  });

  it('affiche un état vide accessible quand aucun modèle ne convient', async () => {
    await setup([]);
    expect(await screen.findByText(/aucun modèle d'abri ne convient/i)).toBeInTheDocument();
  });

  it('ne présente aucune violation WCAG A/AA (résultats rendus)', async () => {
    const { container } = await setup(RESULTS);
    await screen.findByRole('heading', { name: 'Abri simple 11 pi' });
    await expectNoA11yViolations(container);
  });
});
