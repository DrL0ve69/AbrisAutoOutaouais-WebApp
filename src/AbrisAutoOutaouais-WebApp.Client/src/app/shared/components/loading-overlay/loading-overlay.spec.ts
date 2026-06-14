import { render, within } from '@testing-library/angular';
import { describe, it, expect } from 'vitest';
import { provideRouter } from '@angular/router';
import { LoadingOverlayComponent } from './loading-overlay';
import { expectNoA11yViolations } from '../../../../testing/axe-helper';

async function setup() {
  const rendered = await render(LoadingOverlayComponent, {
    providers: [provideRouter([])],
  });
  const q = within(rendered.container as HTMLElement);
  return { ...rendered, q };
}

describe('LoadingOverlayComponent', () => {
  it('est caché par défaut (aucune navigation en cours)', async () => {
    const { container } = await setup();
    // @if(visible()) → rien dans le DOM tant qu'aucune NavigationStart n'a été émise.
    expect(container.querySelector('.loading-overlay')).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('ne présente aucune violation WCAG A/AA quand caché (axe)', async () => {
    const { container } = await setup();
    await expectNoA11yViolations(container);
  });
});
