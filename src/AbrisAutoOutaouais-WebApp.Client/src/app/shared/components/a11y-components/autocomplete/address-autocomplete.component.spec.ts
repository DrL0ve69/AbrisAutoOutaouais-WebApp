import { render, within } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { page } from 'vitest/browser';
import { of } from 'rxjs';
import { Component, signal } from '@angular/core';
import { AddressAutocompleteComponent } from './address-autocomplete.component';
import { PlacesService } from '../../../../core/services/places.service';
import { PlaceSuggestionDto } from '../../../../core/models/place.model';
import { expectNoA11yViolations } from '../../../../../testing/axe-helper';

// Viewport déterministe : le composant n'est pas gated par un breakpoint, mais on fixe
// la fenêtre pour des assertions stables (L-009).
const VIEWPORT = { width: 1024, height: 768 };

const SUGGESTIONS: PlaceSuggestionDto[] = [
  {
    label: '111 rue Wellington, Ottawa, ON',
    civicNumber: '111',
    street: 'rue Wellington',
    city: 'Ottawa',
    province: 'ON',
    postalCode: null,
    lat: null,
    lng: null,
  },
  {
    label: '222 rue Bank, Ottawa, ON',
    civicNumber: '222',
    street: 'rue Bank',
    city: 'Ottawa',
    province: 'ON',
    postalCode: null,
    lat: null,
    lng: null,
  },
];

function placesStub() {
  return {
    suggest: vi.fn().mockReturnValue(of(SUGGESTIONS)),
    lookupPostalCode: vi.fn().mockReturnValue(of({ postalCode: 'K1A 0A6' })),
  };
}

// Hôte minimal : fournit le `<label for>` n'est PAS requis (le composant porte son label).
@Component({
  selector: 'app-host',
  imports: [AddressAutocompleteComponent],
  template: `
    <app-address-autocomplete
      id="street"
      [label]="'Rue'"
      [value]="value()"
      (valueChange)="value.set($event)"
      (suggestionSelected)="selected.set($event)"
    />
    <button type="button" data-testid="next-field">Suivant</button>
  `,
})
class HostComponent {
  readonly value = signal('');
  readonly selected = signal<PlaceSuggestionDto | null>(null);
}

async function setup(stub = placesStub()) {
  await page.viewport(VIEWPORT.width, VIEWPORT.height);
  const rendered = await render(HostComponent, {
    providers: [{ provide: PlacesService, useValue: stub }],
  });
  // Le mode navigateur de vitest PARTAGE le `document` entre fichiers/tests : on scope
  // toutes les requêtes au conteneur rendu (`within`) pour ne pas heurter un `#street`
  // résiduel d'un rendu précédent qui ferait échouer le calcul de nom accessible.
  const q = within(rendered.container as HTMLElement);
  const input = q.getByRole('combobox', { name: /rue/i }) as HTMLInputElement;
  return { ...rendered, q, input, stub };
}

describe('AddressAutocompleteComponent — combobox APG', () => {
  it('combobox correctement étiqueté, fermé au départ', async () => {
    const { input } = await setup();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
  });

  it('porte le jeton WCAG 1.3.5 autocomplete="address-line1" par défaut (EPIC 15)', async () => {
    const { input } = await setup();
    expect(input).toHaveAttribute('autocomplete', 'address-line1');
  });

  it('la frappe ouvre la listbox et annonce le nombre de résultats', async () => {
    const user = userEvent.setup();
    const { input, q } = await setup();

    await user.click(input);
    await user.keyboard('rue Well');

    // Listbox visible + nombre d'options.
    const options = await q.findAllByRole('option');
    expect(options).toHaveLength(2);
    expect(input).toHaveAttribute('aria-expanded', 'true');

    // Compteur ANCRÉ PAR TEXTE (L-010 : status global existe dans app.html).
    const status = q.getByRole('status');
    expect(status).toHaveTextContent(/2 adresse\(s\) trouvée\(s\)/i);
  });

  it('↓↓ déplace aria-activedescendant le long des options', async () => {
    const user = userEvent.setup();
    const { input, q } = await setup();

    await user.click(input);
    await user.keyboard('rue Well');
    await q.findAllByRole('option');

    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', 'street-option-0');

    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', 'street-option-1');

    // L'option active porte aria-selected="true", les autres non.
    const options = q.getAllByRole('option');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(options[0]).toHaveAttribute('aria-selected', 'false');
  });

  it('Entrée sur une option émet suggestionSelected et ferme la liste', async () => {
    const user = userEvent.setup();
    const { input, q, fixture } = await setup();

    await user.click(input);
    await user.keyboard('rue Well');
    await q.findAllByRole('option');

    await user.keyboard('{ArrowDown}{Enter}');

    const host = fixture.componentInstance as HostComponent;
    expect(host.selected()?.street).toBe('rue Wellington');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    // Le focus reste sur l'input (jamais déplacé) — L-006.
    expect(input).toHaveFocus();
  });

  it('Échap ferme la liste et garde le focus sur l’input', async () => {
    const user = userEvent.setup();
    const { input, q } = await setup();

    await user.click(input);
    await user.keyboard('rue Well');
    await q.findAllByRole('option');

    await user.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveFocus();
  });

  it('ferme la listbox quand le focus quitte le composant (Tab vers le champ suivant)', async () => {
    const user = userEvent.setup();
    const { input, q } = await setup();

    await user.click(input);
    await user.keyboard('rue Well');
    await q.findAllByRole('option');
    expect(input).toHaveAttribute('aria-expanded', 'true');

    // Tabulation vers le bouton suivant : le focus sort du composant → la popup doit fermer
    // (APG combobox), sinon `aria-expanded` resterait true avec une listbox orpheline.
    await user.tab();
    expect(q.getByTestId('next-field')).toHaveFocus();
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('ne déclenche aucune requête sous 3 caractères', async () => {
    const user = userEvent.setup();
    const { input, stub } = await setup();

    await user.click(input);
    await user.keyboard('ru');
    expect(stub.suggest).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('ne présente aucune violation WCAG A/AA (fermé puis ouvert)', async () => {
    const user = userEvent.setup();
    const { container, input, q } = await setup();

    await expectNoA11yViolations(container);

    await user.click(input);
    await user.keyboard('rue Well');
    await q.findAllByRole('option');
    await expectNoA11yViolations(container);
  });
});
