import { render, within } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
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

  it('saisie manuelle (PIEDS) : bascule de mode, convertit en cm et émet le gabarit', async () => {
    const user = userEvent.setup();
    const { q, emitted } = await setup();

    await user.click(q.getByRole('radio', { name: /dimensions manuelles/i }));

    // Saisie en pieds → conversion cm (canonique) + arrondi au cm supérieur :
    // 10 pi = 304,8 → 305 cm ; 20 pi = 609,6 → 610 cm.
    await user.type(q.getByLabelText(/largeur/i), '10');
    await user.type(q.getByLabelText(/longueur/i), '20');
    await user.click(q.getByRole('button', { name: /calculer le gabarit/i }));

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({ widthCm: 305, lengthCm: 610, outOfRange: false });
  });

  it('valeur manuelle hors plage (>65 pi) : aucune émission, message annoncé', async () => {
    const user = userEvent.setup();
    const { q, emitted } = await setup();

    await user.click(q.getByRole('radio', { name: /dimensions manuelles/i }));
    await user.type(q.getByLabelText(/largeur/i), '70');
    await user.type(q.getByLabelText(/longueur/i), '20');
    await user.click(q.getByRole('button', { name: /calculer le gabarit/i }));

    // Le validateur Validators.max(65) rend le formulaire invalide → pas d'émission.
    expect(emitted).toHaveLength(0);
    // Un message d'erreur de champ est annoncé (role="alert").
    const alert = q.getByRole('alert');
    expect(alert).toBeInTheDocument();
  });

  it('ne présente aucune violation WCAG A/AA (mode véhicules puis manuel)', async () => {
    const user = userEvent.setup();
    const { container, q } = await setup();

    await expectNoA11yViolations(container);

    await user.click(q.getByRole('radio', { name: /dimensions manuelles/i }));
    await expectNoA11yViolations(container);
  });
});
