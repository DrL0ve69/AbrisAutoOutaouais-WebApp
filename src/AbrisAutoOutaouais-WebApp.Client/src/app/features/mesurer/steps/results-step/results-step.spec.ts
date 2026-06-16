import { render, screen, within } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localeFrCa from '@angular/common/locales/fr-CA';
import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { ResultsStepComponent } from './results-step';
import { ShelterSuggestionService } from '../../../../core/services/shelter-suggestion.service';
import { ShelterSuggestionDto } from '../../../../core/models/shelter-suggestion.model';
import { Footprint } from '../../util/footprint.util';
import { expectNoA11yViolations } from '../../../../../testing/axe-helper';

registerLocaleData(localeFrCa);

const TIGHT: ShelterSuggestionDto = {
  id: 's1',
  name: 'Abri compact double',
  slug: 'abri-serre',
  price: 799,
  rentalPrice: 69,
  categoryName: 'Abris doubles',
  imageUrl: null,
  widthCm: 320,
  lengthCm: 620,
  heightCm: 250,
  widthMarginCm: 5,
  lengthMarginCm: 10,
  isTightFit: true,
  brand: 'Abris Tempo',
  model: 'Tempo Duo 18x20',
};

const ROOMY: ShelterSuggestionDto = {
  id: 's2',
  name: 'Abri spacieux',
  slug: 'abri-spacieux',
  price: 999,
  rentalPrice: null,
  categoryName: 'Abris doubles',
  imageUrl: null,
  widthCm: 420,
  lengthCm: 720,
  heightCm: 260,
  widthMarginCm: 100,
  lengthMarginCm: 100,
  isTightFit: false,
  // G3 — ROOMY sans marque/modèle : exerce le guard `@if (brand || model)` (L-002 : un cas qui
  // DIFFÈRE de l'autre, sinon l'assertion « affiché seulement si présent » ne prouve rien).
  brand: null,
  model: null,
};

const FOOTPRINT: Footprint = { widthCm: 310, lengthCm: 600, outOfRange: false };

async function setup(results: ShelterSuggestionDto[]) {
  const service: Partial<ShelterSuggestionService> = {
    suggestShelters: vi.fn().mockReturnValue(of(results)),
  };
  const rendered = await render(ResultsStepComponent, {
    inputs: { footprint: FOOTPRINT },
    providers: [provideRouter([]), { provide: ShelterSuggestionService, useValue: service }],
  });
  return { ...rendered, service };
}

describe('ResultsStepComponent', () => {
  it('appelle suggestShelters avec le gabarit et rend une carte par abri', async () => {
    const { service } = await setup([TIGHT, ROOMY]);
    expect(service.suggestShelters).toHaveBeenCalledWith(310, 600);
    expect(await screen.findByText('Abri compact double')).toBeInTheDocument();
    expect(screen.getByText('Abri spacieux')).toBeInTheDocument();
  });

  it('affiche marque + modèle (G3) UNIQUEMENT si renseignés (L-002 : un item sans marque)', async () => {
    await setup([TIGHT, ROOMY]);

    const tightCard = (await screen.findByText('Abri compact double')).closest('li')!;
    const roomyCard = screen.getByText('Abri spacieux').closest('li')!;

    // TIGHT porte marque + modèle → affichés tels quels (texte serveur, format inchangé).
    expect(within(tightCard).getByText('Abris Tempo')).toBeInTheDocument();
    expect(within(tightCard).getByText('Tempo Duo 18x20')).toBeInTheDocument();
    // ROOMY sans marque/modèle → aucune ligne marque rendue.
    expect(within(roomyCard).queryByText('Abris Tempo')).not.toBeInTheDocument();
  });

  it('affiche le badge « Ajusté serré » UNIQUEMENT pour isTightFit (L-002 : un item non-serré)', async () => {
    await setup([TIGHT, ROOMY]);

    const tightCard = (await screen.findByText('Abri compact double')).closest('li')!;
    const roomyCard = screen.getByText('Abri spacieux').closest('li')!;

    expect(within(tightCard).getByText(/ajusté serré/i)).toBeInTheDocument();
    expect(within(roomyCard).queryByText(/ajusté serré/i)).not.toBeInTheDocument();
  });

  it('lie chaque carte au détail produit /boutique/{slug}', async () => {
    await setup([TIGHT]);
    const link = (await screen.findAllByRole('link', { name: /abri compact double/i }))[0];
    expect(link).toHaveAttribute('href', '/boutique/abri-serre');
  });

  it('affiche un état vide accessible quand aucun abri ne convient', async () => {
    await setup([]);
    expect(await screen.findByText(/aucun abri ne convient/i)).toBeInTheDocument();
  });

  it('ne présente aucune violation WCAG A/AA (résultats rendus)', async () => {
    const { container } = await setup([TIGHT, ROOMY]);
    await screen.findByText('Abri compact double');
    await expectNoA11yViolations(container);
  });
});
