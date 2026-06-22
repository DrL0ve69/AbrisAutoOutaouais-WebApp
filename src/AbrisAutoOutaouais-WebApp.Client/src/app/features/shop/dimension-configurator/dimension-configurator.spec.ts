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

// Grille de prix exacte : le prix dépend de (longueur, HAUTEUR). On fait VOLONTAIREMENT varier le
// prix par hauteur (à 122 cm : 198 → 349 $, 244 → 749 $) pour prouver que la hauteur change le prix.
// La grille est ÉPARSE : le couple (122, 244) n'est offert QUE si on le déclare ; (366, 244) est
// absent → combinaison non offerte (test dédié). priceCents = dollars × 100.
const PRICE_GRID = [
  { lengthCm: 122, clearHeightCm: 198, priceCents: 34900 }, // 349 $
  { lengthCm: 122, clearHeightCm: 244, priceCents: 74900 }, // 749 $
  { lengthCm: 366, clearHeightCm: 198, priceCents: 54900 }, // 549 $
  { lengthCm: 488, clearHeightCm: 198, priceCents: 64900 }, // 649 $
  // (366, 244) ABSENT volontairement → couple non offert.
];

const MODEL: ShelterModelDetail = {
  id: 'm1',
  slug: 'simple',
  name: 'Abri simple — Abris Tempo',
  categoryId: 'cat-1',
  categoryName: 'Abris simples',
  basePrice: 349, // « à partir de » = min de la grille
  minLengthCm: 122,
  maxLengthCm: 1830,
  lengthStepCm: 122,
  priceGrid: PRICE_GRID,
  widthOptionsCm: [335, 366],
  clearHeightOptionsCm: [198, 244],
};

// Modèle à LARGEUR UNIQUE (rework EPIC 9 : chaque largeur est un modèle distinct) → ligne statique.
const SINGLE_WIDTH_MODEL: ShelterModelDetail = { ...MODEL, widthOptionsCm: [335] };

const base = environment.apiUrl;

async function setup(model: ShelterModelDetail = MODEL, initialLengthCm: number | null = null) {
  await page.viewport(VIEWPORT.width, VIEWPORT.height);
  // Le configurateur émet aussi `null` (recalcul en cours / couple non offert) → on collecte tout.
  const emitted: (ShelterConfiguration | null)[] = [];
  const rendered = await render(DimensionConfiguratorComponent, {
    inputs: { slug: 'simple', initialLengthCm },
    on: { configurationChange: (c: ShelterConfiguration | null) => emitted.push(c) },
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
async function awaitPriceRequest(http: HttpTestingController) {
  const url = `${base}/shelters/simple/price`;
  const deadline = Date.now() + 2000;
  let matches = http.match(r => r.url === url);
  while (matches.length === 0 && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 25));
    matches = http.match(r => r.url === url);
  }
  expect(matches.length, 'la requête de prix débouncée doit avoir été émise').toBeGreaterThan(0);
  return matches[matches.length - 1];
}

/**
 * Sert la prochaine requête de prix (debounce 300 ms) avec un prix valide. Vérifie que la requête
 * porte le COUPLE (lengthCm, clearHeightCm). Réponse SANS `archCount` (retiré du contrat).
 */
async function flushPrice(
  http: HttpTestingController,
  lengthCm: number,
  clearHeightCm: number,
  total: number,
) {
  const req = await awaitPriceRequest(http);
  expect(req.request.params.get('lengthCm')).toBe(String(lengthCm));
  expect(req.request.params.get('clearHeightCm')).toBe(String(clearHeightCm));
  req.flush({ modelId: 'm1', slug: 'simple', lengthCm, clearHeightCm, totalPrice: total });
}

/** Sert la prochaine requête de prix par un 422 (couple non offert dans la grille éparse). */
async function flushUnavailable(
  http: HttpTestingController,
  lengthCm: number,
  clearHeightCm: number,
) {
  const req = await awaitPriceRequest(http);
  expect(req.request.params.get('lengthCm')).toBe(String(lengthCm));
  expect(req.request.params.get('clearHeightCm')).toBe(String(clearHeightCm));
  req.flush('Unprocessable', { status: 422, statusText: 'Unprocessable Entity' });
}

describe('DimensionConfiguratorComponent', () => {
  beforeEach(() => {});
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('affiche les options de largeur/hauteur formatées en pieds', async () => {
    const { q, http } = await setup();
    await flushPrice(http, 122, 198, 349);

    // 335 cm → « 11 pi », 366 cm → « 12 pi ».
    expect(q.getByRole('radio', { name: '11 pi' })).toBeInTheDocument();
    expect(q.getByRole('radio', { name: '12 pi' })).toBeInTheDocument();
    // Hauteurs : 198 → « 6 pi 6 po », 244 → « 8 pi ».
    expect(q.getByRole('radio', { name: '6 pi 6 po' })).toBeInTheDocument();
  });

  it('largeur MULTI-options : rendue en radiogroup APG (flèche bascule la sélection ET le focus)', async () => {
    const user = userEvent.setup();
    const { q, http } = await setup();
    await flushPrice(http, 122, 198, 349);

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
    await flushPrice(http, 122, 198, 349);

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
    await flushPrice(http, 122, 198, 349);

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
    // 1er prix : longueur min 122, hauteur 198 → 349 $. La config porte width/length/height (sans archCount).
    await flushPrice(http, 122, 198, 349);
    expect(emitted.at(-1)).toMatchObject({
      lengthCm: 122,
      widthCm: 335,
      clearHeightCm: 198,
      totalPrice: 349,
    });
    // archCount a été RETIRÉ du contrat : il ne doit plus figurer dans la config émise.
    expect(emitted.at(-1)).not.toHaveProperty('archCount');

    // Change la longueur via le <select> (366 cm → « 12 pi »).
    const select = q.getByLabelText(/longueur/i) as HTMLSelectElement;
    await user.selectOptions(select, '12 pi');

    // (366, 198) → 549 $ (grille). La requête porte la longueur 366 ET la hauteur 198.
    await flushPrice(http, 366, 198, 549);

    expect(await q.findByText(/549/)).toBeInTheDocument();
    expect(emitted.at(-1)).toMatchObject({
      lengthCm: 366,
      widthCm: 335,
      clearHeightCm: 198,
      totalPrice: 549,
    });
  });

  it('le PRIX dépend de la HAUTEUR : changer la hauteur change le prix affiché ET relance /price avec le bon clearHeightCm', async () => {
    const user = userEvent.setup();
    const { q, http } = await setup();
    // (122, 198) → 349 $ (prix optimiste = lookup grille, puis confirmé serveur).
    await flushPrice(http, 122, 198, 349);
    expect(await q.findByText(/349/)).toBeInTheDocument();

    // Sélectionne la 2e hauteur (244 cm → « 8 pi ») : le prix optimiste passe IMMÉDIATEMENT à 749
    // (lookup grille) et un nouvel appel /price part avec clearHeightCm=244.
    const height244 = q.getByRole('radio', { name: '8 pi' });
    await user.click(height244);

    // La requête de prix relancée porte bien la NOUVELLE hauteur (244), pas l'ancienne (198).
    await flushPrice(http, 122, 244, 749);
    expect(await q.findByText(/749/)).toBeInTheDocument();
  });

  it('combinaison ÉPARSE non offerte : pas de prix, message « non offerte », pas d’émission de config', async () => {
    const user = userEvent.setup();
    const { q, http, emitted } = await setup();
    // 1er couple offert (122, 198) → 349 $.
    await flushPrice(http, 122, 198, 349);

    // Passe à 366 cm (couple (366, 198) offert) — une config est émise ici.
    const select = q.getByLabelText(/longueur/i) as HTMLSelectElement;
    await user.selectOptions(select, '12 pi'); // 366 cm
    await flushPrice(http, 366, 198, 549); // (366, 198) offert
    // À CE POINT une config VALIDE (non-null) a été émise pour le couple offert.
    expect(emitted.at(-1)).not.toBeNull();

    // Passe à la hauteur 244 cm : le couple (366, 244) est ABSENT de la grille.
    const height244 = q.getByRole('radio', { name: '8 pi' });
    await user.click(height244);

    // (366, 244) absent → le serveur répond 422.
    await flushUnavailable(http, 366, 244);

    // Message d’indisponibilité affiché ET annoncé : le texte apparaît à DEUX endroits (le bloc
    // prix visible ET la région aria-live `role="status"`). On attend qu'au moins un nœud le porte,
    // puis on vérifie que les deux surfaces (prix + status) sont bien présentes.
    await q.findAllByText(/n.est pas offerte pour ce mod/i);
    const matches = q.getAllByText(/n.est pas offerte pour ce mod/i);
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(q.getByRole('status')).toHaveTextContent(/n.est pas offerte pour ce mod/i);
    // CŒUR DU CORRECTIF (L-046) : la dernière émission est `null` → la config confirmée précédente
    // est INVALIDÉE chez le parent (canAdd retombe faux). Sans cela, on pourrait commander un abri
    // dont la combinaison est marquée « non offerte ».
    expect(emitted.at(-1)).toBeNull();
  });

  it('annonce le prix en aria-live (état neutre avant réannonce — L-027)', async () => {
    const { q, http } = await setup();
    await flushPrice(http, 122, 198, 349);

    // La région role="status" finit par porter le message de prix (CD post-réponse serveur).
    const status = await q.findByText(/Prix mis à jour/i);
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('initialLengthCm (deep-link) : clampe à la plus grande option ≤ valeur demandée (EPIC 10)', async () => {
    // Demande 500 cm : les options sont 122, 244, 366, 488, 610… → la plus grande ≤ 500 est 488.
    // Le 1er appel de prix part donc sur 488 (pas 122) : la longueur clampée pilote tout.
    const { emitted, http } = await setup(MODEL, 500);
    await flushPrice(http, 488, 198, 649); // (488, 198) offert dans la grille.

    expect(emitted.at(-1)).toMatchObject({ lengthCm: 488 });
  });

  it('initialLengthCm null/invalide : retombe sur la longueur minimale', async () => {
    const { http } = await setup(MODEL, null);
    // Aucun clamp → 1re requête de prix sur la longueur min (122).
    await flushPrice(http, 122, 198, 349);
  });

  it('ne présente aucune violation WCAG A/AA (axe)', async () => {
    const { container, http } = await setup();
    await flushPrice(http, 122, 198, 349);
    await expectNoA11yViolations(container);
  });
});
