import { render, within } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { page } from 'vitest/browser';
import { DimensionStepComponent } from './dimension-step';
import { Footprint } from '../../util/footprint.util';
import { expectNoA11yViolations } from '../../../../../testing/axe-helper';

// Viewport déterministe (L-009) — assertions stables.
const VIEWPORT = { width: 1024, height: 768 };

async function setup() {
  await page.viewport(VIEWPORT.width, VIEWPORT.height);
  const emitted: Footprint[] = [];
  const rendered = await render(DimensionStepComponent, {
    on: { footprintComputed: (f: Footprint) => emitted.push(f) },
  });
  const q = within(rendered.container as HTMLElement);
  return { ...rendered, q, emitted };
}

describe('DimensionStepComponent — radiogroup à 3 voies', () => {
  it('propose les 3 voies, avec « Par mes véhicules » sélectionnée par défaut', async () => {
    const { q } = await setup();

    const group = within(
      q.getByRole('radiogroup', { name: /comment souhaitez-vous obtenir vos dimensions/i }),
    );
    expect(group.getAllByRole('radio')).toHaveLength(3);

    const vehicles = q.getByRole('radio', { name: /par mes véhicules/i });
    expect(vehicles).toHaveAttribute('aria-checked', 'true');
    expect(vehicles).toHaveAttribute('tabindex', '0');
    // Défaut = véhicules → le calculateur véhicules est rendu (assertion positive, L-009).
    expect(q.getByLabelText(/berline/i)).toBeInTheDocument();
  });

  it('le radiogroup a un nom accessible NON vide (L-040)', async () => {
    const { q } = await setup();
    // getByRole avec name /.+/  échoue si l'accessible name est vide.
    expect(q.getByRole('radiogroup', { name: /.+/ })).toBeInTheDocument();
  });

  it('roving tabindex : seule la voie sélectionnée est dans l’ordre de tabulation', async () => {
    const { q } = await setup();

    const known = q.getByRole('radio', { name: /je connais mes dimensions/i });
    const vehicles = q.getByRole('radio', { name: /par mes véhicules/i });
    const map = q.getByRole('radio', { name: /mesurer sur la carte/i });

    expect(vehicles).toHaveAttribute('tabindex', '0');
    expect(known).toHaveAttribute('tabindex', '-1');
    expect(map).toHaveAttribute('tabindex', '-1');
  });

  it('APG : flèche bascule la sélection ET déplace le focus (roving tabindex, L-015)', async () => {
    const user = userEvent.setup();
    const { q } = await setup();

    const known = q.getByRole('radio', { name: /je connais mes dimensions/i });
    const vehicles = q.getByRole('radio', { name: /par mes véhicules/i });

    // Flèche gauche depuis « véhicules » (index 1) → « known » (index 0) avec bouclage.
    vehicles.focus();
    await user.keyboard('{ArrowLeft}');

    expect(known).toHaveAttribute('aria-checked', 'true');
    expect(known).toHaveFocus();
    expect(known).toHaveAttribute('tabindex', '0');
    expect(vehicles).toHaveAttribute('tabindex', '-1');
    // Le panneau « je connais mes dimensions » est rendu (assertion positive, pas que l'attribut).
    expect(q.getByRole('button', { name: /voir les abris compatibles/i })).toBeInTheDocument();
  });

  it('voie « je connais mes dimensions » : émet le gabarit calculé', async () => {
    const user = userEvent.setup();
    const { q, emitted } = await setup();

    await user.click(q.getByRole('radio', { name: /je connais mes dimensions/i }));
    await user.type(q.getByLabelText(/largeur/i), '10');
    await user.type(q.getByLabelText(/longueur/i), '20');
    await user.click(q.getByRole('button', { name: /voir les abris compatibles/i }));

    // 10 pi → 305 cm, 20 pi → 610 cm.
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({ widthCm: 305, lengthCm: 610, outOfRange: false });
  });

  it('voie « par mes véhicules » : émet le gabarit calculé', async () => {
    const user = userEvent.setup();
    const { q, emitted } = await setup();

    await user.click(q.getByLabelText(/berline/i));
    await user.keyboard('{Backspace}1');
    await user.click(q.getByRole('button', { name: /calculer le gabarit/i }));

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({ widthCm: 310, lengthCm: 600, outOfRange: false });
  });

  it('ne présente aucune violation WCAG A/AA (voies known et vehicles)', async () => {
    const user = userEvent.setup();
    const { container, q } = await setup();

    // Voie véhicules (défaut).
    await expectNoA11yViolations(container);

    // Voie known.
    await user.click(q.getByRole('radio', { name: /je connais mes dimensions/i }));
    await expectNoA11yViolations(container);
  });
});
