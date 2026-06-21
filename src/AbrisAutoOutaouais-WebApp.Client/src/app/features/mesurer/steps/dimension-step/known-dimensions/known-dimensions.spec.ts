import { render, within } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { page } from 'vitest/browser';
import { KnownDimensionsComponent } from './known-dimensions';
import { Footprint } from '../../../util/footprint.util';
import { expectNoA11yViolations } from '../../../../../../testing/axe-helper';

// Viewport déterministe (L-009) — assertions stables.
const VIEWPORT = { width: 1024, height: 768 };

async function setup() {
  await page.viewport(VIEWPORT.width, VIEWPORT.height);
  const emitted: Footprint[] = [];
  const rendered = await render(KnownDimensionsComponent, {
    on: { footprintComputed: (f: Footprint) => emitted.push(f) },
  });
  const q = within(rendered.container as HTMLElement);
  return { ...rendered, q, emitted };
}

describe('KnownDimensionsComponent', () => {
  it('saisie en PIEDS : convertit en cm (canonique) et émet le gabarit', async () => {
    const user = userEvent.setup();
    const { q, emitted } = await setup();

    // 10 pi = 304,8 → 305 cm ; 20 pi = 609,6 → 610 cm (arrondi au cm supérieur).
    await user.type(q.getByLabelText(/largeur/i), '10');
    await user.type(q.getByLabelText(/longueur/i), '20');
    await user.click(q.getByRole('button', { name: /voir les abris compatibles/i }));

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({ widthCm: 305, lengthCm: 610, outOfRange: false });
  });

  it('valeur hors plage (>65 pi) : aucune émission, message d’erreur annoncé', async () => {
    const user = userEvent.setup();
    const { q, emitted } = await setup();

    await user.type(q.getByLabelText(/largeur/i), '70');
    await user.type(q.getByLabelText(/longueur/i), '20');
    await user.click(q.getByRole('button', { name: /voir les abris compatibles/i }));

    // Validators.max(65) → formulaire invalide → pas d'émission.
    expect(emitted).toHaveLength(0);
    // Un message d'erreur de champ est annoncé (role="alert").
    expect(q.getByRole('alert')).toBeInTheDocument();
  });

  it('formulaire vide soumis : aucune émission (champs requis)', async () => {
    const user = userEvent.setup();
    const { q, emitted } = await setup();

    await user.click(q.getByRole('button', { name: /voir les abris compatibles/i }));

    expect(emitted).toHaveLength(0);
    // Les deux champs requis affichent leur erreur.
    expect(q.getAllByRole('alert')).toHaveLength(2);
  });

  it('ne présente aucune violation WCAG A/AA', async () => {
    const { container } = await setup();
    await expectNoA11yViolations(container);
  });
});
