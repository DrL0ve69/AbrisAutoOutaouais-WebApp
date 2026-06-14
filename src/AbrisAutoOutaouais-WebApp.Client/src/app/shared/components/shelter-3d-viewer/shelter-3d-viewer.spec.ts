import { render } from '@testing-library/angular';
import { within } from '@testing-library/dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Shelter3dViewerComponent } from './shelter-3d-viewer';
import { expectNoA11yViolations } from '../../../../testing/axe-helper';

// On contrôle la disponibilité WebGL via un mock du module util : par défaut INDISPONIBLE, pour
// exercer le repli statique SANS jamais instancier `three` (la branche WebGL importe la lib lourde).
const webglAvailable = { value: false };
vi.mock('./webgl.util', () => ({
  isWebglAvailable: () => webglAvailable.value,
}));

const inputs = {
  widthCm: 400,
  lengthCm: 600,
  heightCm: 250,
  fallbackImageSrc: '/images/products/abri-double.svg',
  productName: 'Abri double Tempo',
};

async function setup() {
  return render(Shelter3dViewerComponent, { inputs });
}

describe('Shelter3dViewerComponent', () => {
  beforeEach(() => {
    webglAvailable.value = false;
  });

  it("affiche le repli <img> (alt = nom produit) quand WebGL est indisponible", async () => {
    const { container } = await setup();
    // L'init bascule `unsupported` dans afterNextRender → laisse Angular stabiliser.
    await new Promise(r => setTimeout(r, 0));

    const img = within(container).getByRole('img', { name: 'Abri double Tempo' });
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toBe('/images/products/abri-double.svg');

    // Aucun canvas ni barre de commande tant que la 3D n'est pas montée.
    expect(within(container).queryByRole('group')).not.toBeInTheDocument();
  });

  it('ne présente aucune violation WCAG A/AA en mode repli (axe)', async () => {
    const { container } = await setup();
    await new Promise(r => setTimeout(r, 0));
    await expectNoA11yViolations(container);
  });

  it('expose un libellé accessible incluant le nom du produit (computed)', async () => {
    const { fixture } = await setup();
    const cmp = fixture.componentInstance as unknown as {
      canvasLabel(): string;
    };
    expect(cmp.canvasLabel()).toContain('Abri double Tempo');
  });
});
