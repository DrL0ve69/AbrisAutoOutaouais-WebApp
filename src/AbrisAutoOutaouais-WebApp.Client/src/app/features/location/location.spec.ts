import { render, screen, within } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { registerLocaleData } from '@angular/common';
import localeFrCa from '@angular/common/locales/fr-CA';
import { LocationComponent } from './location';
import { ShelterService } from '../../core/services/shelter.service';
import { RentalService } from '../../core/services/rental.service';
import { AuthService } from '../../core/services/auth.service';
import { RentableShelterModel } from '../../core/models/shelter.model';
import { expectNoA11yViolations } from '../../../testing/axe-helper';

// Affiche des tarifs via CurrencyPipe('fr-CA') → données de locale requises.
registerLocaleData(localeFrCa);

const rentable: RentableShelterModel[] = [
  {
    slug: 'simple-11pi',
    name: 'Abri simple 11 pi',
    categoryName: 'Abris simples',
    monthlyRentalPrice: 89,
    minLengthCm: 335,
    maxLengthCm: 671,
    lengthStepCm: 168,
    widthCm: 335,
    clearHeightOptionsCm: [198, 244],
    priceGrid: [
      { lengthCm: 335, clearHeightCm: 198, priceCents: 120000 },
      { lengthCm: 503, clearHeightCm: 198, priceCents: 140000 },
      { lengthCm: 671, clearHeightCm: 244, priceCents: 160000 },
    ],
  },
];

function shelterStub(models = rentable): Partial<ShelterService> {
  return { getRentableModels: () => of(models) };
}

/** Réponse de création canonique (EPIC 7.2) : id + instructions de virement Interac. */
const createOk = {
  id: 'r1',
  payment: {
    reference: 'ABR-LOC-0001',
    recipientEmail: 'paiements@abristempo-local.example',
    amount: 89,
    instructions: 'Faites un virement Interac.',
  },
};

async function setup(
  shelter: Partial<ShelterService> = shelterStub(),
  rentals: Partial<RentalService> = { createRental: vi.fn().mockReturnValue(of(createOk)) },
  authenticated = true,
) {
  // Connecté par défaut : le bloc « coordonnées invité » (Épic F) n'est alors pas exigé, on cible
  // le rework taille → soumission. `isAuthenticated` est un signal computed → stub par une fonction.
  const auth: Partial<AuthService> = {
    isAuthenticated: (() => authenticated) as AuthService['isAuthenticated'],
  };
  const result = await render(LocationComponent, {
    providers: [
      // Routes-cibles de la navigation post-succès (accueil + mes locations) déclarées pour éviter
      // une rejection router asynchrone après la soumission (L-019 : suite propre).
      provideRouter([
        { path: '', children: [] },
        { path: 'mon-compte/locations', children: [] },
      ]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ShelterService, useValue: shelter },
      { provide: RentalService, useValue: rentals },
      { provide: AuthService, useValue: auth },
    ],
  });
  return { ...result, rentals };
}

describe('LocationComponent — location sur modèles', () => {
  it('liste les modèles louables avec leur tarif mensuel forfaitaire', async () => {
    await setup();

    expect(await screen.findByText(/abri simple 11 pi/i)).toBeInTheDocument();
    // Le tarif mensuel (89 $) est affiché (CurrencyPipe fr-CA), suivi de « / mois ».
    expect(screen.getByText(/\/ mois/i)).toBeInTheDocument();
  });

  it('affiche le sélecteur de taille seulement APRÈS la sélection d\'un modèle', async () => {
    const user = userEvent.setup();
    await setup();

    // Avant sélection : pas de radiogroup de hauteur.
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();

    await user.click(await screen.findByText(/abri simple 11 pi/i));

    // Après sélection : le <select> de longueur + le radiogroup de hauteur apparaissent.
    expect(screen.getByRole('combobox', { name: /longueur/i })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: /hauteur dégagée/i })).toBeInTheDocument();
  });

  it('radiogroup hauteur : roving tabindex + flèche déplace sélection ET focus (APG, L-015)', async () => {
    const user = userEvent.setup();
    await setup();
    await user.click(await screen.findByText(/abri simple 11 pi/i));

    const group = screen.getByRole('radiogroup', { name: /hauteur dégagée/i });
    const radios = within(group).getAllByRole('radio');
    // Roving tabindex : la 1re option est le seul stop (tabindex=0), les autres -1.
    expect(radios[0]).toHaveAttribute('tabindex', '0');
    expect(radios[1]).toHaveAttribute('tabindex', '-1');
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');

    radios[0].focus();
    await user.keyboard('{ArrowRight}');

    // La flèche déplace la sélection ET le focus sur la 2e option.
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
    expect(radios[1]).toHaveFocus();
  });

  it('soumet { slug, lengthCm, clearHeightCm, … } après un choix de taille offert', async () => {
    const user = userEvent.setup();
    const createRental = vi.fn().mockReturnValue(of(createOk));
    const { fixture } = await setup(shelterStub(), { createRental });

    await user.click(await screen.findByText(/abri simple 11 pi/i));

    // Longueur 335 cm (« 11 pi ») + hauteur 198 cm (1re option) = couple offert dans la grille.
    // On sélectionne par l'OPTION (le `[ngValue]` numérique sérialise « 0: 335 » côté DOM).
    const lengthSelect = screen.getByRole('combobox', { name: /longueur/i });
    await user.selectOptions(lengthSelect, within(lengthSelect).getByRole('option', { name: '11 pi' }));

    // Période + adresse minimale : on patche directement le formulaire d'adresse (le câblage
    // autocomplete/pastille est testé ailleurs) pour cibler le rework taille → soumission.
    const cmp = fixture.componentInstance as unknown as {
      form: { patchValue(v: Record<string, string>): void };
    };
    cmp.form.patchValue({
      startDate: '2026-07-01',
      endDate: '2026-09-01',
      addressLine1: '123 Rue Principale',
      city: 'Gatineau',
      province: 'QC',
      postalCode: 'J8X 1A1',
    });

    await user.click(screen.getByRole('button', { name: /confirmer la location/i }));

    expect(createRental).toHaveBeenCalledTimes(1);
    expect(createRental).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'simple-11pi', lengthCm: 335, clearHeightCm: 198 }),
    );
  });

  it('après soumission, affiche le panneau de virement Interac avec la référence (état terminal — L-053)', async () => {
    const user = userEvent.setup();
    const createRental = vi.fn().mockReturnValue(of(createOk));
    const { fixture } = await setup(shelterStub(), { createRental });

    await user.click(await screen.findByText(/abri simple 11 pi/i));
    const lengthSelect = screen.getByRole('combobox', { name: /longueur/i });
    await user.selectOptions(lengthSelect, within(lengthSelect).getByRole('option', { name: '11 pi' }));

    const cmp = fixture.componentInstance as unknown as {
      form: { patchValue(v: Record<string, string>): void };
    };
    cmp.form.patchValue({
      startDate: '2026-07-01',
      endDate: '2026-09-01',
      addressLine1: '123 Rue Principale',
      city: 'Gatineau',
      province: 'QC',
      postalCode: 'J8X 1A1',
    });

    await user.click(screen.getByRole('button', { name: /confirmer la location/i }));

    // L'étape « instructions » prime (L-053) : le panneau e-Transfer est rendu avec ses valeurs.
    expect(
      await screen.findByRole('heading', { name: /réglez votre location par virement interac/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('ABR-LOC-0001')).toBeInTheDocument();
    expect(screen.getByText(/paiements@abristempo-local\.example/i)).toBeInTheDocument();
    // Le formulaire de location a disparu (état terminal).
    expect(screen.queryByRole('button', { name: /confirmer la location/i })).not.toBeInTheDocument();
  });

  it('bloque la soumission + affiche « non offerte » quand le couple (longueur, hauteur) est hors grille (L-047)', async () => {
    const user = userEvent.setup();
    const createRental = vi.fn().mockReturnValue(of(createOk));
    const { fixture } = await setup(shelterStub(), { createRental });

    await user.click(await screen.findByText(/abri simple 11 pi/i));

    // Longueur 671 cm (« 22 pi ») n'est offerte qu'à la hauteur 244 dans la grille du stub ; on garde
    // la hauteur par défaut (index 0 = 198) → couple HORS grille (combinationOffered = false).
    const lengthSelect = screen.getByRole('combobox', { name: /longueur/i });
    await user.selectOptions(lengthSelect, within(lengthSelect).getByRole('option', { name: '22 pi' }));

    // Message d'indisponibilité affiché (role=alert).
    expect(await screen.findByRole('alert')).toHaveTextContent(/n.est pas offerte/i);

    // Adresse/dates valides — seule la taille hors grille doit bloquer.
    const cmp = fixture.componentInstance as unknown as {
      form: { patchValue(v: Record<string, string>): void };
    };
    cmp.form.patchValue({
      startDate: '2026-07-01',
      endDate: '2026-09-01',
      addressLine1: '123 Rue Principale',
      city: 'Gatineau',
      province: 'QC',
      postalCode: 'J8X 1A1',
    });

    await user.click(screen.getByRole('button', { name: /confirmer la location/i }));
    expect(createRental).not.toHaveBeenCalled();
  });

  it('empêche la soumission tant qu\'aucune taille n\'est choisie', async () => {
    const user = userEvent.setup();
    const createRental = vi.fn().mockReturnValue(of(createOk));
    await setup(shelterStub(), { createRental });

    await user.click(await screen.findByText(/abri simple 11 pi/i));
    // Aucune longueur sélectionnée → soumission bloquée.
    await user.click(screen.getByRole('button', { name: /confirmer la location/i }));

    expect(createRental).not.toHaveBeenCalled();
  });

  it('affiche l\'état vide quand aucun modèle n\'est louable', async () => {
    await setup(shelterStub([]));

    expect(await screen.findByText(/aucun abri n.est disponible à la location/i)).toBeInTheDocument();
  });

  it('ne présente aucune violation WCAG A/AA (axe), modèle + taille rendus', async () => {
    const user = userEvent.setup();
    const { container } = await setup();
    await user.click(await screen.findByText(/abri simple 11 pi/i));
    // Sélecteur de taille rendu (combobox longueur + radiogroup hauteur).
    await screen.findByRole('radiogroup', { name: /hauteur dégagée/i });

    await expectNoA11yViolations(container);
  });
});
