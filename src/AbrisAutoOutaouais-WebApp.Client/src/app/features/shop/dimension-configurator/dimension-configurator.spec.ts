import { render, within } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { page } from 'vitest/browser';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { registerLocaleData } from '@angular/common';
import localeFrCa from '@angular/common/locales/fr-CA';
import { DimensionConfiguratorComponent, ShelterConfiguration } from './dimension-configurator';
import { environment } from '../../../../environments/environment';
import { ShelterModelDetail } from '../../../core/models/shelter.model';
import { expectNoA11yViolations } from '../../../../testing/axe-helper';

registerLocaleData(localeFrCa);

const VIEWPORT = { width: 1024, height: 768 };

const MODEL: ShelterModelDetail = {
  id: 'm1',
  slug: 'simple',
  name: 'Abri simple — Abris Tempo',
  categoryId: 'cat-1',
  categoryName: 'Abris simples',
  basePrice: 349,
  minLengthCm: 122,
  maxLengthCm: 1830,
  lengthStepCm: 122,
  pricePerArchCents: 10000, // 100 $ / arche
  widthOptionsCm: [335, 366],
  clearHeightOptionsCm: [198, 244],
};

// Modèle à LARGEUR UNIQUE (rework EPIC 9 : chaque largeur est un modèle distinct) → ligne statique.
const SINGLE_WIDTH_MODEL: ShelterModelDetail = { ...MODEL, widthOptionsCm: [335] };

const base = environment.apiUrl;

async function setup(model: ShelterModelDetail = MODEL) {
  await page.viewport(VIEWPORT.width, VIEWPORT.height);
  const emitted: ShelterConfiguration[] = [];
  const rendered = await render(DimensionConfiguratorComponent, {
    inputs: { slug: 'simple' },
    on: { configurationChange: (c: ShelterConfiguration) => emitted.push(c) },
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  const http = TestBed.inject(HttpTestingController);
  // Réponse du détail du modèle (déclenche le 1er calcul de prix).
  http.expectOne(`${base}/shelters/simple`).flush(model);
  const q = within(rendered.container as HTMLElement);
  return { ...rendered, q, http, emitted };
}

/**
 * Sert la prochaine requête de prix (debounce 300 ms) avec une réponse serveur. Le pipeline
 * `debounceTime(300)` n'émet la requête qu'après le délai : on attend donc qu'elle apparaisse
 * (poll avec timers réels du runner navigateur), jamais un `expectOne` synchrone immédiat.
 */
async function flushPrice(
  http: HttpTestingController,
  lengthCm: number,
  archCount: number,
  total: number,
) {
  const url = `${base}/shelters/simple/price`;
  const deadline = Date.now() + 2000;
  let matches = http.match(r => r.url === url);
  while (matches.length === 0 && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 25));
    matches = http.match(r => r.url === url);
  }
  expect(matches.length, 'la requête de prix débouncée doit avoir été émise').toBeGreaterThan(0);
  const req = matches[matches.length - 1];
  expect(req.request.params.get('lengthCm')).toBe(String(lengthCm));
  req.flush({ modelId: 'm1', slug: 'simple', lengthCm, archCount, totalPrice: total });
}

describe('DimensionConfiguratorComponent', () => {
  beforeEach(() => {});
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('affiche les options de largeur/hauteur formatées en pieds', async () => {
    const { q, http } = await setup();
    await flushPrice(http, 122, 0, 349);

    // 335 cm → « 11 pi », 366 cm → « 12 pi ».
    expect(q.getByRole('radio', { name: '11 pi' })).toBeInTheDocument();
    expect(q.getByRole('radio', { name: '12 pi' })).toBeInTheDocument();
    // Hauteurs : 198 → « 6 pi 6 po », 244 → « 8 pi ».
    expect(q.getByRole('radio', { name: '6 pi 6 po' })).toBeInTheDocument();
  });

  it('largeur MULTI-options : rendue en radiogroup APG (flèche bascule la sélection ET le focus)', async () => {
    const user = userEvent.setup();
    const { q, http } = await setup();
    await flushPrice(http, 122, 0, 349);

    const first = q.getByRole('radio', { name: '11 pi' });
    const second = q.getByRole('radio', { name: '12 pi' });

    expect(first).toHaveAttribute('aria-checked', 'true');
    expect(first).toHaveAttribute('tabindex', '0');
    expect(second).toHaveAttribute('tabindex', '-1');

    first.focus();
    await user.keyboard('{ArrowRight}');

    expect(second).toHaveAttribute('aria-checked', 'true');
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute('tabindex', '0');
    expect(first).toHaveAttribute('tabindex', '-1');
  });

  it('largeur à OPTION UNIQUE : rendue en ligne statique (pas de radiogroup) ; selectedWidthCm = la seule largeur', async () => {
    const { q, http, emitted } = await setup(SINGLE_WIDTH_MODEL);
    await flushPrice(http, 122, 0, 349);

    // Aucun radio de largeur : la largeur unique est une ligne statique « Largeur : 11 pi ».
    expect(q.queryByRole('radio', { name: '11 pi' })).toBeNull();
    expect(q.getByText('Largeur :')).toBeInTheDocument();
    // La config émise porte bien la largeur unique (335 cm), même sans radiogroup.
    expect(emitted.at(-1)).toMatchObject({ widthCm: 335 });
    // Les radios de HAUTEUR existent toujours (ce groupe reste multi-options).
    expect(q.getByRole('radio', { name: '6 pi 6 po' })).toBeInTheDocument();
  });

  it('longueur : rendue comme <select> (choix discret), PAS de slider/number', async () => {
    const { q, container, http } = await setup();
    await flushPrice(http, 122, 0, 349);

    // Un <select> libellé « Longueur » avec les multiples du pas (122 → 1830 par 122 = 15 options).
    const select = q.getByLabelText(/longueur/i) as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT');
    expect(select.options.length).toBe(15);
    // Une option « 12 pi » (366 cm) existe parmi les longueurs offertes.
    expect(Array.from(select.options).some(o => o.textContent?.trim() === '12 pi')).toBe(true);
    // Aucun input range/number résiduel (l'ancien curseur a été retiré).
    expect((container as HTMLElement).querySelector('input[type="range"]')).toBeNull();
    expect((container as HTMLElement).querySelector('input[type="number"]')).toBeNull();
  });

  it('recalcule le prix au changement de longueur (source serveur) et émet la config avec width+length+height', async () => {
    const user = userEvent.setup();
    const { q, http, emitted } = await setup();
    // 1er prix : longueur min 122, 0 arche → 349 $. La config porte width/length/height.
    await flushPrice(http, 122, 0, 349);
    expect(emitted.at(-1)).toMatchObject({
      lengthCm: 122,
      widthCm: 335,
      clearHeightCm: 198,
      archCount: 0,
      totalPrice: 349,
    });

    // Change la longueur via le <select> (366 cm → « 12 pi »).
    const select = q.getByLabelText(/longueur/i) as HTMLSelectElement;
    await user.selectOptions(select, '12 pi');

    // 366 cm = min + 2 pas → 2 arches → 349 + 200 = 549 $.
    await flushPrice(http, 366, 2, 549);

    expect(await q.findByText(/549/)).toBeInTheDocument();
    expect(emitted.at(-1)).toMatchObject({
      lengthCm: 366,
      widthCm: 335,
      clearHeightCm: 198,
      archCount: 2,
      totalPrice: 549,
    });
  });

  it('annonce le prix en aria-live (état neutre avant réannonce — L-027)', async () => {
    const { q, http } = await setup();
    await flushPrice(http, 122, 0, 349);

    // La région role="status" finit par porter le message de prix (CD post-réponse serveur).
    const status = await q.findByText(/Prix mis à jour/i);
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('ne présente aucune violation WCAG A/AA (axe)', async () => {
    const { container, http } = await setup();
    await flushPrice(http, 122, 0, 349);
    await expectNoA11yViolations(container);
  });
});
