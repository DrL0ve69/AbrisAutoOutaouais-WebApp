import { render, within } from '@testing-library/angular';
import { describe, it, expect } from 'vitest';
import { MapMeasureComponent } from './map-measure';
import { expectNoA11yViolations } from '../../../../../../testing/axe-helper';

// `map-measure` importe Leaflet/geoman/turf DYNAMIQUEMENT dans `afterNextRender`. L'indice
// « adresse non localisée » qui nous intéresse est rendu par le `computed` notLocated()
// INDÉPENDAMMENT de l'init carte (le template l'évalue au premier rendu, avant tout chargement
// de Leaflet) — c'est sur ce DOM qu'on assert, sans dépendre d'un vrai conteneur Leaflet.
// (`vi.mock` n'intercepte pas les deps pré-bundlées en mode navigateur ; `initMap` est plutôt
// rendu robuste à un geoman absent par une garde côté composant — voir map-measure.ts.)

async function setup(inputs: { lat: number | null; lng: number | null }) {
  const rendered = await render(MapMeasureComponent, { inputs });
  // Le mode navigateur de vitest partage le `document` : on scope par conteneur (L-013).
  const q = within(rendered.container as HTMLElement);
  return { ...rendered, q };
}

describe('MapMeasureComponent', () => {
  it('adresse NON localisée (lat/lng null) : affiche l’indice ET le canvas le référence', async () => {
    const { q } = await setup({ lat: null, lng: null });

    // Assertion POSITIVE : l'indice est rendu (L-009 — pas d'assertion vacue).
    const hint = q.getByText(/adresse non localisée précisément/i);
    expect(hint).toBeInTheDocument();
    expect(hint).toHaveAttribute('id', 'map-not-located');

    // Un seul nœud porte l'id (L-013).
    expect(q.queryAllByText(/adresse non localisée précisément/i)).toHaveLength(1);

    // Le canvas (role="application") rattache l'indice à sa description accessible.
    const canvas = q.getByRole('application');
    expect(canvas).toHaveAttribute(
      'aria-describedby',
      'map-instructions map-not-located',
    );
  });

  it('adresse localisée (lat/lng fournis) : l’indice est ABSENT et le canvas ne le référence pas', async () => {
    const { q } = await setup({ lat: 45.42, lng: -75.7 });

    // Assertion NÉGATIVE doublée d'une positive : le canvas existe bien (L-009).
    expect(q.queryByText(/adresse non localisée précisément/i)).not.toBeInTheDocument();

    const canvas = q.getByRole('application');
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute('aria-describedby', 'map-instructions');
  });

  it('ne présente aucune violation WCAG A/AA (indice affiché)', async () => {
    const { container } = await setup({ lat: null, lng: null });
    await expectNoA11yViolations(container);
  });
});
