import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { render, screen, waitFor } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { ProfileComponent } from './profile';
import { expectNoA11yViolations } from '../../../../testing/axe-helper';
import { UserProfileDto } from '../../../core/models/profile.model';
import { AddressDto } from '../../../core/models/booking.model';

/**
 * Régression du bug « le profil ne sauvegarde pas ».
 * Cause : le validateur du code postal exigeait 6 caractères SANS espace, alors que
 * l'indice du champ affiche « A1A 1A1 » (avec espace). Saisir le code comme indiqué
 * invalidait le formulaire → `saveAddress()` sortait sans rien envoyer. (Leçon L-001.)
 */
describe('ProfileComponent — code postal', () => {
  // Le formulaire est créé dès la construction (initialisation de champ), donc inutile
  // de déclencher ngOnInit / un appel HTTP pour tester sa validation.
  type Control = { setValue(v: string): void; valid: boolean };
  type Internals = {
    addressForm: { controls: { postalCode: Control; addressLine1: Control } };
  };

  let postal: Control;
  let line1: Control;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(ProfileComponent);
    const controls = (fixture.componentInstance as unknown as Internals).addressForm.controls;
    postal = controls.postalCode;
    // EPIC 15 — champ unifié « n° et rue ».
    line1 = controls.addressLine1;
  });

  it("accepte « J8X 1A1 » (format avec espace, exactement comme l'indice)", () => {
    postal.setValue('J8X 1A1');
    expect(postal.valid).toBe(true);
  });

  it('accepte « J8X1A1 » (sans espace)', () => {
    postal.setValue('J8X1A1');
    expect(postal.valid).toBe(true);
  });

  it('rejette un code manifestement invalide', () => {
    postal.setValue('12345');
    expect(postal.valid).toBe(false);
  });

  it('accepte une ligne « n° et rue » valide (« 123 rue X » et « 123A boul Y »)', () => {
    line1.setValue('123 rue X');
    expect(line1.valid).toBe(true);
    line1.setValue('123A boul Y');
    expect(line1.valid).toBe(true);
  });

  it('rejette une ligne sans numéro civique en tête (« rue X »)', () => {
    line1.setValue('rue X');
    expect(line1.valid).toBe(false);
  });

  it('accepte une ligne vide (adresse de profil OPTIONNELLE)', () => {
    line1.setValue('');
    expect(line1.valid).toBe(true);
  });
});

/**
 * E2 — alerte non bloquante « entrez votre adresse » à la première connexion.
 * Décision marqueur sans backend : l'alerte s'affiche quand `GET /auth/me` renvoie
 * une adresse vide ET qu'elle n'a pas déjà été rejetée (drapeau localStorage par
 * userId). On scope les locators PAR TEXTE — jamais `getByRole('status')` nu —
 * car app.html porte déjà des régions status globales (leçon L-010).
 */
describe('ProfileComponent — alerte d’adresse (E2)', () => {
  const USER_ID = '11111111-1111-1111-1111-111111111111';
  const AUTH_USER = {
    id: USER_ID,
    email: 'client@test.com',
    username: 'client',
    firstName: 'Camille',
    lastName: 'Client',
    roles: ['Customer'],
    avatar: null,
  };

  const ADDRESS: AddressDto = {
    civicNumber: '111',
    street: 'rue Wellington',
    apartment: null,
    city: 'Ottawa',
    province: 'ON',
    postalCode: 'K1A 0A6',
    country: 'Canada',
  };

  function profileWith(address: AddressDto | null): UserProfileDto {
    return {
      id: USER_ID,
      email: AUTH_USER.email,
      username: AUTH_USER.username,
      firstName: AUTH_USER.firstName,
      lastName: AUTH_USER.lastName,
      phoneNumber: null,
      avatar: null,
      preferredLanguage: 'fr',
      defaultDeliveryAddress: address,
      createdAt: '2026-01-01T00:00:00Z',
      roles: ['Customer'],
    };
  }

  beforeEach(() => {
    localStorage.clear();
    // AuthService lit l'utilisateur (et donc l'id) depuis localStorage au démarrage.
    localStorage.setItem('auth_token', 'fake.jwt');
    localStorage.setItem('auth_user', JSON.stringify(AUTH_USER));
  });

  /** Monte le composant et sert la réponse `/auth/me` avec l'adresse fournie. */
  async function setup(address: AddressDto | null) {
    const rendered = await render(ProfileComponent, {
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const httpMock = rendered.fixture.debugElement.injector.get(HttpTestingController);
    httpMock.expectOne((r) => r.url.endsWith('/auth/me')).flush(profileWith(address));
    rendered.fixture.detectChanges();
    return { ...rendered, httpMock };
  }

  it('affiche la bannière quand /auth/me ne renvoie PAS d’adresse', async () => {
    await setup(null);
    expect(
      await screen.findByText(/ajoutez votre adresse de livraison/i),
    ).toBeInTheDocument();
  });

  it('n’affiche PAS la bannière quand une adresse est déjà enregistrée (L-002)', async () => {
    await setup(ADDRESS);
    // POSITIF : l'onglet adresse est bien rendu (la page n'est pas vide)…
    expect(screen.getByRole('tab', { name: /adresse de livraison/i })).toBeInTheDocument();
    // …NÉGATIF : aucune alerte d'adresse.
    expect(screen.queryByText(/ajoutez votre adresse de livraison/i)).toBeNull();
  });

  it('n’affiche PAS la bannière si elle a déjà été rejetée (localStorage)', async () => {
    localStorage.setItem('first-address-hint-dismissed:' + USER_ID, '1');
    await setup(null);
    expect(screen.queryByText(/ajoutez votre adresse de livraison/i)).toBeNull();
  });

  it('« J’ai compris » ferme l’alerte et renvoie le focus vers l’onglet Adresse (L-006)', async () => {
    const user = userEvent.setup();
    await setup(null);

    expect(await screen.findByText(/ajoutez votre adresse de livraison/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /j.ai compris/i }));

    // L'alerte disparaît…
    await waitFor(() =>
      expect(screen.queryByText(/ajoutez votre adresse de livraison/i)).toBeNull(),
    );
    // …et le focus est renvoyé vers une cible STABLE montée (l'onglet Adresse) APRÈS rendu.
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /adresse de livraison/i })).toHaveFocus(),
    );
  });

  it('« Aller à mon adresse » active l’onglet Adresse', async () => {
    const user = userEvent.setup();
    await setup(null);

    await user.click(await screen.findByRole('button', { name: /aller à mon adresse/i }));
    expect(screen.getByRole('tab', { name: /adresse de livraison/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('aucune violation axe (bannière affichée)', async () => {
    const { container } = await setup(null);
    expect(await screen.findByText(/ajoutez votre adresse de livraison/i)).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});
