import { render, within } from '@testing-library/angular';
import { describe, it, expect } from 'vitest';
import { MeasureStepComponent } from './measure-step';
import { expectNoA11yViolations } from '../../../../../testing/axe-helper';

// Le défaut est le mode CALCULATEUR (clavier) : la carte Leaflet n'est PAS montée ici, donc on
// peut rendre le composant sans charger les libs lourdes. On vérifie l'avertissement « hors zone »
// (D5) sur ce DOM — rendu par un simple `@if (outOfServiceArea())`, indépendant de la carte.

async function setup(inputs: { lat: number | null; lng: number | null; outOfServiceArea: boolean }) {
  const rendered = await render(MeasureStepComponent, { inputs });
  // Le mode navigateur de vitest partage le `document` : on scope par conteneur (L-013).
  const q = within(rendered.container as HTMLElement);
  return { ...rendered, q };
}

describe('MeasureStepComponent — avertissement hors zone (D5)', () => {
  it('outOfServiceArea = true : affiche un statut « hors zone » poli (non bloquant)', async () => {
    const { q } = await setup({ lat: 45.5019, lng: -73.5674, outOfServiceArea: true });

    // Assertion POSITIVE (L-009) : le message est rendu, en tant que role="status" poli.
    const warning = q.getByText(/hors de notre zone de livraison/i);
    expect(warning).toBeInTheDocument();
    expect(warning).toHaveAttribute('role', 'status');
    expect(warning).toHaveAttribute('aria-live', 'polite');

    // Non bloquant : le radiogroup de CHOIX DE MÉTHODE reste pleinement utilisable (le mode
    // calculateur par défaut ajoute son propre radiogroup, d'où plusieurs `radio` sur la page —
    // on cible donc le groupe « méthode de mesure » par son libellé accessible).
    const methodGroup = within(q.getByRole('radiogroup', { name: /méthode de mesure/i }));
    expect(methodGroup.getAllByRole('radio')).toHaveLength(2);
  });

  it('outOfServiceArea = false : aucun avertissement (assertion négative doublée d’une positive)', async () => {
    const { q } = await setup({ lat: 45.42, lng: -75.7, outOfServiceArea: false });

    expect(q.queryByText(/hors de notre zone de livraison/i)).not.toBeInTheDocument();
    // Positive : le composant est bien rendu (le radiogroup de méthode existe).
    const methodGroup = within(q.getByRole('radiogroup', { name: /méthode de mesure/i }));
    expect(methodGroup.getAllByRole('radio')).toHaveLength(2);
  });

  it('ne présente aucune violation WCAG A/AA (avertissement affiché)', async () => {
    const { container } = await setup({ lat: 45.5019, lng: -73.5674, outOfServiceArea: true });
    await expectNoA11yViolations(container);
  });
});
