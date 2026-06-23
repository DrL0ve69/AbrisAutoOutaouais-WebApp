import { render } from '@testing-library/angular';
import { describe, it } from 'vitest';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localeFrCa from '@angular/common/locales/fr-CA';
import { HomeComponent } from './home';
import { ShelterService } from '../../core/services/shelter.service';
import { ShelterModelSummary } from '../../core/models/shelter.model';
import { expectNoA11yViolations } from '../../../testing/axe-helper';

registerLocaleData(localeFrCa);

const models: ShelterModelSummary[] = [
  {
    id: 'm1',
    slug: 'simple-11pi',
    name: 'Abri simple 11 pi',
    categoryName: 'Abris simples',
    basePrice: 349,
    minLengthCm: 335,
    maxLengthCm: 671,
    lengthStepCm: 61,
  },
  {
    id: 'm2',
    slug: 'double-16pi',
    name: 'Abri double 16 pi',
    categoryName: 'Abris doubles',
    basePrice: 599,
    minLengthCm: 488,
    maxLengthCm: 1220,
    lengthStepCm: 61,
  },
];

describe('HomeComponent (accessibilité)', () => {
  it('ne présente aucune violation WCAG A/AA (axe)', async () => {
    const stub: Partial<ShelterService> = {
      getModels: () => of(models),
    };

    const { container } = await render(HomeComponent, {
      providers: [provideRouter([]), { provide: ShelterService, useValue: stub }],
    });

    await expectNoA11yViolations(container);
  });
});
