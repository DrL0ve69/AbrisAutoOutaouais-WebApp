import { render, screen } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { FaqComponent } from './faq.component';
import { INSTALLATION_FAQ, LOCATION_FAQ } from '../../content/faq.data';
import { expectNoA11yViolations } from '../../../../testing/axe-helper';

describe('FaqComponent', () => {
  it('rend une question par entrée, repliée par défaut, sans violation axe', async () => {
    const { container } = await render(FaqComponent, {
      inputs: { entries: INSTALLATION_FAQ, headingId: 'install-faq' },
    });

    // Une question (et son <summary>) par entrée, chacune présente dans le DOM.
    for (const entry of INSTALLATION_FAQ) {
      expect(screen.getByText(entry.question)).toBeInTheDocument();
    }
    expect(container.querySelectorAll('summary').length).toBe(INSTALLATION_FAQ.length);

    // Replié par défaut : le <details> n'a pas l'attribut open.
    const details = container.querySelectorAll('details');
    expect(details.length).toBe(INSTALLATION_FAQ.length);
    details.forEach(d => expect(d.open).toBe(false));

    await expectNoA11yViolations(container);
  });

  it('ouvre puis ferme un panneau au clic sur la question (élément natif)', async () => {
    const user = userEvent.setup();
    const { container } = await render(FaqComponent, {
      inputs: { entries: LOCATION_FAQ, headingId: 'loc-faq' },
    });

    const firstQuestion = screen.getByText(LOCATION_FAQ[0].question);
    const firstDetails = container.querySelector('details')!;

    expect(firstDetails.open).toBe(false);
    await user.click(firstQuestion);
    expect(firstDetails.open).toBe(true);
    // La réponse est alors visible dans le DOM.
    expect(screen.getByText(LOCATION_FAQ[0].answer)).toBeVisible();

    await user.click(firstQuestion);
    expect(firstDetails.open).toBe(false);

    await expectNoA11yViolations(container);
  });

  it('inclut la mention « autres marques sauf ShelterLogic » sur la FAQ installation', async () => {
    await render(FaqComponent, {
      inputs: { entries: INSTALLATION_FAQ, headingId: 'install-faq' },
    });

    // Texte informatif requis par le cahier des charges (H-FAQ).
    expect(screen.getByText(/ShelterLogic/)).toBeInTheDocument();
  });

  it('lie le titre de section via aria-labelledby au headingId fourni', async () => {
    const { container } = await render(FaqComponent, {
      inputs: { entries: LOCATION_FAQ, headingId: 'loc-faq' },
    });

    const section = container.querySelector('section')!;
    expect(section.getAttribute('aria-labelledby')).toBe('loc-faq');
    expect(container.querySelector('#loc-faq')).not.toBeNull();
  });
});
