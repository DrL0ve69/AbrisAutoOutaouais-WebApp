import { render, within } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { page } from 'vitest/browser';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { GuestContactComponent } from './guest-contact.component';
import { buildGuestContactGroup } from '../../../../core/validators/guest-contact.validators';
import { expectNoA11yViolations } from '../../../../../testing/axe-helper';

const VIEWPORT = { width: 1024, height: 768 };

// Hôte minimal : porte le FormGroup (idiome adresse — le groupe vit sur l'écran parent).
@Component({
  selector: 'app-host',
  imports: [GuestContactComponent, ReactiveFormsModule],
  template: `<app-guest-contact [group]="group" idPrefix="t" />`,
})
class HostComponent {
  private readonly fb = inject(FormBuilder);
  readonly group = buildGuestContactGroup(this.fb);
}

async function setup() {
  await page.viewport(VIEWPORT.width, VIEWPORT.height);
  const rendered = await render(HostComponent);
  // Le mode navigateur de vitest partage le `document` : on scope par conteneur (L-013).
  const q = within(rendered.container as HTMLElement);
  return { ...rendered, q, host: rendered.fixture.componentInstance as HostComponent };
}

describe('GuestContactComponent', () => {
  it('rend les champs étiquetés et liés au FormGroup du parent', async () => {
    const user = userEvent.setup();
    const { q, host } = await setup();

    await user.type(q.getByLabelText('Prénom'), 'Camille');
    await user.type(q.getByLabelText('Nom'), 'Invitée');
    await user.type(q.getByLabelText('Courriel'), 'camille@exemple.com');
    await user.type(q.getByLabelText(/téléphone/i), '819 555-0123');

    expect(host.group.getRawValue()).toEqual({
      firstName: 'Camille',
      lastName: 'Invitée',
      email: 'camille@exemple.com',
      phone: '819 555-0123',
    });
    expect(host.group.valid).toBe(true);
  });

  it('un courriel invalide rend le groupe invalide et affiche l’erreur reliée (aria-describedby)', async () => {
    const user = userEvent.setup();
    const { q, host } = await setup();

    const email = q.getByLabelText('Courriel');
    await user.type(email, 'pas-un-courriel');
    await user.tab(); // touche le champ → l'erreur s'affiche

    expect(host.group.controls.email.invalid).toBe(true);
    const err = q.getByRole('alert');
    expect(err).toBeInTheDocument();
    // L'erreur est reliée au champ (a11y) ET unique sur la page (idPrefix, L-013).
    expect(email.getAttribute('aria-describedby')).toBe(err.id);
    expect(email.id).toBe('t-guest-email');
  });

  it('prénom et nom requis → invalides quand vides après interaction', async () => {
    const user = userEvent.setup();
    const { q, host } = await setup();

    await user.click(q.getByLabelText('Prénom'));
    await user.tab();
    await user.click(q.getByLabelText('Nom'));
    await user.tab();

    expect(host.group.controls.firstName.invalid).toBe(true);
    expect(host.group.controls.lastName.invalid).toBe(true);
  });

  it('téléphone optionnel : vide ⇒ valide', async () => {
    const user = userEvent.setup();
    const { q, host } = await setup();

    await user.type(q.getByLabelText('Prénom'), 'A');
    await user.type(q.getByLabelText('Nom'), 'B');
    await user.type(q.getByLabelText('Courriel'), 'a@b.com');

    expect(host.group.controls.phone.value).toBe('');
    expect(host.group.valid).toBe(true);
  });

  it('ne présente aucune violation WCAG A/AA', async () => {
    const { container } = await setup();
    await expectNoA11yViolations(container);
  });
});
