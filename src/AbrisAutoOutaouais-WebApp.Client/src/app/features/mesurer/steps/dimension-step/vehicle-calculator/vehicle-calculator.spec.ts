import { render, within } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { page } from 'vitest/browser';
import { VehicleCalculatorComponent } from './vehicle-calculator';
import { Footprint } from '../../../util/footprint.util';
import { expectNoA11yViolations } from '../../../../../../testing/axe-helper';

// Viewport déterministe (L-009) — le composant n'est pas gated par breakpoint mais on fixe
// la fenêtre pour des assertions stables.
const VIEWPORT = { width: 1024, height: 768 };

async function setup() {
  await page.viewport(VIEWPORT.width, VIEWPORT.height);
  const emitted: Footprint[] = [];
  const rendered = await render(VehicleCalculatorComponent, {
    on: { footprintComputed: (f: Footprint) => emitted.push(f) },
  });
  const q = within(rendered.container as HTMLElement);
  return { ...rendered, q, emitted };
}

describe('VehicleCalculatorComponent', () => {
  it('calcule un gabarit au CLAVIER (berline ×1) et émet footprintComputed', async () => {
    const user = userEvent.setup();
    const { q, emitted } = await setup();

    const berline = q.getByLabelText(/berline/i);
    await user.click(berline);
    await user.keyboard('{Backspace}1'); // remplace le 0 par 1 au clavier

    await user.click(q.getByRole('button', { name: /calculer le gabarit/i }));

    expect(emitted).toHaveLength(1);
    // berline 190×480 + 2·60 → 310×600.
    expect(emitted[0]).toMatchObject({ widthCm: 310, lengthCm: 600, outOfRange: false });
  });

  it('le formulaire véhicules est rendu directement (plus de bascule de mode — 13.1)', async () => {
    const { q } = await setup();

    // EPIC 13.1 : l'ancien radiogroup « véhicules / manuel » a disparu ; le calculateur
    // ne porte plus que le radiogroup d'orientation (et seulement avec ≥ 2 véhicules).
    expect(q.queryByRole('radio', { name: /dimensions manuelles/i })).toBeNull();
    expect(q.queryByRole('radio', { name: /par véhicules/i })).toBeNull();
    // Positive : le formulaire véhicules est bien présent d'emblée.
    expect(q.getByLabelText(/berline/i)).toBeInTheDocument();
  });

  it('orientation : le radiogroup n’apparaît qu’avec ≥ 2 véhicules', async () => {
    const user = userEvent.setup();
    const { q } = await setup();

    // 0 véhicule → pas de sélecteur d'orientation.
    expect(q.queryByRole('radiogroup', { name: /disposition des véhicules/i })).toBeNull();

    // 2 berlines → le sélecteur apparaît.
    const berline = q.getByLabelText(/berline/i);
    await user.click(berline);
    await user.keyboard('{Backspace}2');

    expect(
      await q.findByRole('radiogroup', { name: /disposition des véhicules/i }),
    ).toBeInTheDocument();
  });

  it('orientation APG : flèche bascule la sélection ET déplace le focus (roving tabindex, L-015)', async () => {
    const user = userEvent.setup();
    const { q } = await setup();

    await user.click(q.getByLabelText(/berline/i));
    await user.keyboard('{Backspace}2');
    await q.findByRole('radiogroup', { name: /disposition des véhicules/i });

    const side = q.getByRole('radio', { name: /côte à côte/i });
    const behind = q.getByRole('radio', { name: /l'un derrière l'autre/i });

    expect(side).toHaveAttribute('aria-checked', 'true');
    expect(side).toHaveAttribute('tabindex', '0');
    expect(behind).toHaveAttribute('tabindex', '-1');

    side.focus();
    await user.keyboard('{ArrowRight}');

    expect(behind).toHaveAttribute('aria-checked', 'true');
    expect(behind).toHaveFocus();
    expect(behind).toHaveAttribute('tabindex', '0');
    expect(side).toHaveAttribute('tabindex', '-1');
  });

  it('orientation « derrière » donne un footprint DIFFÉRENT (longueurs additionnées)', async () => {
    const user = userEvent.setup();
    const { q, emitted } = await setup();

    // 2 berlines, côte à côte (défaut) → 560×600.
    await user.click(q.getByLabelText(/berline/i));
    await user.keyboard('{Backspace}2');
    await user.click(q.getByRole('button', { name: /calculer le gabarit/i }));
    expect(emitted.at(-1)).toMatchObject({ widthCm: 560, lengthCm: 600 });

    // Bascule « l'un derrière l'autre » → longueurs additionnées : 310×1140.
    await user.click(q.getByRole('radio', { name: /l'un derrière l'autre/i }));
    await user.click(q.getByRole('button', { name: /calculer le gabarit/i }));
    expect(emitted.at(-1)).toMatchObject({ widthCm: 310, lengthCm: 1140 });
  });

  it('ne présente aucune violation WCAG A/AA (véhicules + orientation)', async () => {
    const user = userEvent.setup();
    const { container, q } = await setup();

    await expectNoA11yViolations(container);

    // Avec orientation visible (≥ 2 véhicules).
    await user.click(q.getByLabelText(/berline/i));
    await user.keyboard('{Backspace}2');
    await q.findByRole('radiogroup', { name: /disposition des véhicules/i });
    await expectNoA11yViolations(container);
  });
});
