import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ── e2e : vue planning (US-11.1, EPIC 11) — calendrier en lecture seule.
// Vérifie dans un VRAI navigateur ce que vitest/axe-statique ne couvrent pas :
//  • le CONTRAT CLAVIER APG de la grille (role="grid") et de la bascule de vue
//    (role="radiogroup") — flèches déplacent focus ET cellule/vue active ensemble
//    (AXE ne teste que les attributs statiques — L-015) ;
//  • le panneau « RDV du jour » (Enter ouvre + focus, Échap ferme + rend le focus) ;
//  • l'accès Staff réel à /planning (route HORS /admin, garde staffGuard) — non
//    vacuité : prouvé en révoquant le rôle (un Customer est redirigé) ;
//  • un balayage axe WCAG AA dans LES DEUX thèmes, navbar scrollée (verre) — le
//    contraste n'est PAS couvert en vitest (color-contrast désactivé — L-016).
// API simulée via page.route (réponse dérivée de la fenêtre `from` demandée).

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// Fuseau FORCÉ : rend les assertions d'heure déterministes (indépendantes du fuseau
// de la machine CI) et permet de prouver que le panneau affiche l'heure LOCALE et non
// UTC — un RDV à 12:00Z doit s'afficher « 08:00 » en EDT, pas « 12:00 ».
test.use({ timezoneId: 'America/Toronto' });

const STAFF_USER = {
  id: '88888888-8888-8888-8888-888888888888',
  email: 'staff@abrisauto.com',
  username: 'staff',
  firstName: 'Sam',
  lastName: 'Staff',
  roles: ['Staff'],
  avatar: null,
};

const CUSTOMER_USER = {
  id: '77777777-7777-7777-7777-777777777777',
  email: 'camille@test.com',
  username: 'camille',
  firstName: 'Camille',
  lastName: 'Client',
  roles: ['Customer'],
  avatar: null,
};

const ADMIN_USER = {
  id: '99999999-9999-9999-9999-999999999999',
  email: 'admin@abrisauto.com',
  username: 'admin',
  firstName: 'Ada',
  lastName: 'Admin',
  roles: ['Admin'],
  avatar: null,
};

/**
 * Renvoie des réservations situées DANS la fenêtre demandée : on lit le `from`
 * (1ʳᵉ cellule visible) et on place les RDV à `from + 7/8 jours` à midi UTC (donc
 * même date locale en Amérique/Toronto) → ils tombent dans la grille rendue, quel
 * que soit le mois courant (test déterministe, indépendant de la date du jour).
 */
function calendarRowsForWindow(fromIso: string) {
  const base = new Date(`${fromIso}T00:00:00Z`);
  const dayIso = (offset: number) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  return [
    {
      id: 'cal-1',
      slotStart: `${dayIso(7)}T12:00:00Z`,
      slotEnd: `${dayIso(7)}T14:00:00Z`,
      type: 'Installation',
      status: 'Confirmed',
      customerName: 'Camille Client',
      city: 'Gatineau',
    },
    {
      id: 'cal-2',
      slotStart: `${dayIso(8)}T14:00:00Z`,
      slotEnd: `${dayIso(8)}T16:00:00Z`,
      type: 'Removal',
      status: 'Pending',
      customerName: 'Benoît Acheteur',
      city: 'Hull',
    },
  ];
}

/**
 * Détail d'une journée (US-11.2) dérivé de la date demandée : un RDV stocké 12:00Z–14:00Z (→
 * 08:00–10:00 en EDT) et un employé dont StartMinutes=480 / EndMinutes=1020 (→ « 08:00 » local).
 * Les minutes sont du LOCAL depuis minuit (pas d'UTC), donc 480 s'affiche « 08:00 » quel que soit
 * le fuseau (L-044) — d'où le double contrôle : RDV en fuseau local ET heures en minutes locales.
 */
function dayDetailForDate(dateIso: string) {
  return {
    date: dateIso,
    bookings: [
      {
        id: 'cal-1',
        slotStart: `${dateIso}T12:00:00Z`,
        slotEnd: `${dateIso}T14:00:00Z`,
        type: 'Installation',
        status: 'Confirmed',
        customerName: 'Camille Client',
        city: 'Gatineau',
      },
    ],
    staff: [
      {
        employeeId: 's1',
        fullName: 'Sam Staff',
        startMinutes: 480, // 08:00 local
        endMinutes: 1020, // 17:00 local
        note: 'Quart du matin',
        hasEntry: true,
      },
    ],
  };
}

async function signIn(page: Page, user: typeof STAFF_USER): Promise<void> {
  await page.addInitScript(
    (data) => {
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', data.user);
    },
    { token: 'e2e.fake.jwt', user: JSON.stringify(user) },
  );
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: { ...user, defaultDeliveryAddress: null, preferredLanguage: 'fr' } }),
  );
  await page.route('**/api/v1/bookings/calendar**', (route) => {
    const from = new URL(route.request().url()).searchParams.get('from') ?? '2026-06-01';
    route.fulfill({ json: calendarRowsForWindow(from) });
  });
  await page.route('**/api/v1/planning/day**', (route) => {
    const date =
      new URL(route.request().url()).searchParams.get('date') ?? '2026-06-08';
    route.fulfill({ json: dayDetailForDate(date) });
  });
  // PUT des heures (Admin) — réponse 200 simulée.
  await page.route('**/api/v1/planning/work-hours', (route) =>
    route.fulfill({ json: { id: 'wh1' } }),
  );
  // Créneaux libres du jour (US-11.2 p2) — un créneau stocké 12:00Z (→ 08:00 EDT) dérivé du `from`.
  await page.route('**/api/v1/bookings/available-slots**', (route) => {
    const from = new URL(route.request().url()).searchParams.get('from') ?? '2026-06-08';
    route.fulfill({
      json: [{ start: `${from}T12:00:00Z`, end: `${from}T14:00:00Z` }],
    });
  });
  // Recherche de clients (US-11.2 p2) — liste filtrée simulée.
  await page.route('**/api/v1/planning/customers**', (route) =>
    route.fulfill({
      json: [{ id: 'cust-1', fullName: 'Roxane Existante', email: 'roxane@test.com' }],
    }),
  );
  // POST /bookings (création du RDV) — 201 simulé.
  await page.route('**/api/v1/bookings', (route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({ status: 201, json: { id: 'new-rdv' } });
    } else {
      route.fallback();
    }
  });
}

function forceTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  return page.addInitScript((t) => {
    try {
      localStorage.setItem('abristempo-theme', t);
    } catch {
      /* localStorage indisponible — ignoré */
    }
  }, theme);
}

/**
 * /planning est protégé par authGuard + staffGuard. En SSR le serveur n'a pas le
 * localStorage → un goto direct redirige. On charge « / » (qui s'hydrate et devient
 * authentifiée côté client) puis on clique le lien « Planning » de la navbar pour que
 * les gardes s'exécutent côté navigateur (même approche qu'admin-management.spec.ts).
 */
async function gotoPlanning(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('link', { name: 'Planning', exact: true }).first().click();
  await expect(page).toHaveURL(/\/planning$/);
  await expect(page.getByRole('grid')).toBeVisible();
}

/** Clé ISO (data-key) de la cellule actuellement active (roving tabindex = 0). */
function activeCellKey(page: Page): Promise<string | null> {
  return page.locator('[role="gridcell"][tabindex="0"]').getAttribute('data-key');
}

test('Staff atteint /planning et la grille du calendrier se rend', async ({ page }) => {
  await signIn(page, STAFF_USER);
  await gotoPlanning(page);

  await expect(page.getByRole('heading', { name: /calendrier des rendez-vous/i })).toBeVisible();
  // Au moins une cellule porte des RDV (les mocks tombent dans la fenêtre).
  await expect(page.locator('.cal__cell--has').first()).toBeVisible();
});

test('Accès refusé à un Customer (non vacuité de staffGuard — L-005)', async ({ page }) => {
  await signIn(page, CUSTOMER_USER);
  await page.goto('/');
  // Le lien « Planning » n'apparaît pas pour un Customer ; un goto direct est redirigé
  // vers l'accueil par staffGuard (côté navigateur après hydratation).
  await expect(page.getByRole('link', { name: 'Planning', exact: true })).toHaveCount(0);
  await page.goto('/planning');
  await expect(page).toHaveURL(/\/$|\/accueil$/);
  await expect(page.getByRole('grid')).toHaveCount(0);
});

test('Grille — navigation clavier APG (flèche déplace focus ET cellule active)', async ({
  page,
}) => {
  await signIn(page, STAFF_USER);
  await gotoPlanning(page);

  const before = await activeCellKey(page);
  expect(before).not.toBeNull();

  // Jour attendu après ArrowRight (= jour suivant, en vue mois). Calculé pour pouvoir
  // utiliser un matcher qui RÉESSAIE (toHaveAttribute) plutôt qu'une lecture one-shot
  // qui court avant le flush du rendu signal (race CD — famille L-012).
  const next = new Date(`${before}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const expected = next.toISOString().slice(0, 10);

  // La cellule active (tabindex 0) reçoit le focus puis la flèche droite = jour suivant.
  await page.locator('[role="gridcell"][tabindex="0"]').focus();
  await page.keyboard.press('ArrowRight');

  // Le focus ET la cellule active (roving tabindex) ont suivi sur le jour suivant.
  const focused = page.locator('[role="gridcell"]:focus');
  await expect(focused).toHaveAttribute('data-key', expected);
  await expect(page.locator('[role="gridcell"][tabindex="0"]')).toHaveAttribute(
    'data-key',
    expected,
  );
  expect(expected).not.toBe(before);
});

test('Bascule de vue — radiogroup APG au clavier (flèche change la vue active)', async ({
  page,
}) => {
  await signIn(page, STAFF_USER);
  await gotoPlanning(page);

  const group = page.getByRole('radiogroup', { name: /granularité/i });
  const month = group.getByRole('radio', { name: 'Mois' });
  await expect(month).toHaveAttribute('aria-checked', 'true');

  await month.focus();
  await page.keyboard.press('ArrowRight');

  const week = group.getByRole('radio', { name: 'Semaine' });
  await expect(week).toBeFocused();
  await expect(week).toHaveAttribute('aria-checked', 'true');
  await expect(month).toHaveAttribute('aria-checked', 'false');
  // La grille a basculé en vue semaine (7 cellules).
  await expect(page.locator('[role="gridcell"]')).toHaveCount(7);
});

test('Dialogue « détail du jour » — Enter ouvre + focus, Échap ferme + rend le focus (L-006)', async ({
  page,
}) => {
  await signIn(page, STAFF_USER);
  await gotoPlanning(page);

  const trigger = page.locator('[role="gridcell"][tabindex="0"]');
  await trigger.focus();
  await page.keyboard.press('Enter');

  // Le dialogue (role="dialog") s'ouvre et reçoit le focus. Son nom accessible (date)
  // est garanti non vide même avant l'arrivée du détail async (L-040).
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeFocused();
  await expect(dialog).toHaveAccessibleName(/.+/);

  // Échap referme et rend le focus à la cellule déclencheuse (WCAG 2.4.3).
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('Panneau — heure affichée en fuseau LOCAL, pas UTC (cohérence inter-écrans, L-004)', async ({
  page,
}) => {
  await signIn(page, STAFF_USER);
  await gotoPlanning(page);

  // 1ʳᵉ cellule porteuse de RDV (= jour from+7, RDV mocké à 12:00Z–14:00Z).
  await page.locator('.cal__cell--has').first().click();
  const panel = page.locator('aside.cal__panel');
  await expect(panel).toBeVisible();

  // En America/Toronto (EDT, UTC-4), 12:00Z = 08:00 local et 14:00Z = 10:00 local.
  // Si le gabarit affichait en UTC, on lirait « 12:00–14:00 » → ce test échouerait.
  await expect(panel.getByText('08:00–10:00')).toBeVisible();
  await expect(panel.getByText(/12:00.*14:00/)).toHaveCount(0);
});

test('Heures (lecture seule Staff) — StartMinutes=480 s’affiche « 08:00 » (L-044)', async ({
  page,
}) => {
  await signIn(page, STAFF_USER);
  await gotoPlanning(page);

  await page.locator('.cal__cell--has').first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Staff = lecture seule : aucun champ éditable, mais les heures (480/1020 min locales) s'affichent.
  await expect(dialog.getByRole('textbox')).toHaveCount(0);
  await expect(dialog.getByText(/08:00\s*–\s*17:00/)).toBeVisible();
});

test('Admin — formulaire d’heures éditable ; enregistrer appelle l’API', async ({ page }) => {
  await signIn(page, ADMIN_USER);
  await gotoPlanning(page);

  await page.locator('.cal__cell--has').first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Le champ « Début » est pré-rempli avec l'heure LOCALE 08:00 (StartMinutes=480).
  const group = dialog.getByRole('group', { name: /heures de sam staff/i });
  const startInput = group.locator('input[type="time"]').first();
  await expect(startInput).toHaveValue('08:00');

  // Enregistrer déclenche le PUT (mocké 200) puis annonce la réussite.
  const putPromise = page.waitForRequest('**/api/v1/planning/work-hours');
  await group.getByRole('button', { name: /enregistrer les heures de sam staff/i }).click();
  const request = await putPromise;
  expect(request.method()).toBe('PUT');
  const body = JSON.parse(request.postData() ?? '{}');
  expect(body.startMinutes).toBe(480);
  expect(body.endMinutes).toBe(1020);
});

test('Admin — ajout d’un RDV (client existant) bout-en-bout ; créneau 12:00Z → « 08:00 » (L-044)', async ({
  page,
}) => {
  await signIn(page, ADMIN_USER);
  await gotoPlanning(page);

  // Ouvrir le dialogue jour puis déployer le sous-formulaire d'ajout.
  await page.locator('.cal__cell--has').first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /\+ ajouter un rdv/i }).click();

  // Le créneau libre s'affiche en heure LOCALE (12:00Z → 08 h en America/Toronto, L-044).
  // fr-CA formate « 08 h 00 » (pas « 08:00 ») — l'essentiel : 08 h, jamais 12 h.
  const slotGroup = dialog.getByRole('radiogroup', { name: /créneaux disponibles/i });
  const slot = slotGroup.getByRole('radio').first();
  await expect(slot).toContainText(/08\s*h\s*00/);
  await expect(slotGroup.getByText(/12\s*h/)).toHaveCount(0);
  await slot.click();
  await expect(slot).toHaveAttribute('aria-checked', 'true');

  // Mode « Client existant » → rechercher et sélectionner.
  await dialog.getByRole('radio', { name: /client existant/i }).click();
  await dialog.getByRole('searchbox', { name: /rechercher un client/i }).fill('rox');
  const result = dialog.getByRole('button', { name: /roxane existante/i });
  await expect(result).toBeVisible();
  await result.click();

  // Adresse minimale.
  await dialog.getByRole('textbox', { name: /n° civique/i }).fill('12');
  await dialog.getByRole('textbox', { name: /rue/i }).fill('rue Test');
  await dialog.getByRole('textbox', { name: /ville/i }).fill('Gatineau');
  await dialog.getByRole('textbox', { name: /code postal/i }).fill('J8X 1A1');

  // Soumettre → le POST /bookings part avec le bon créneau + targetCustomerId.
  const postPromise = page.waitForRequest(
    (req) => req.url().endsWith('/api/v1/bookings') && req.method() === 'POST',
  );
  await dialog.getByRole('button', { name: /créer le rendez-vous/i }).click();
  const request = await postPromise;
  const body = JSON.parse(request.postData() ?? '{}');
  expect(body.targetCustomerId).toBe('cust-1');
  expect(body.guestContact).toBeNull();
  expect(body.slotStart).toMatch(/T12:00:00/); // valeur ISO UTC brute envoyée (L-044)
});

test('Admin — sous-formulaire d’ajout : focus + Échap ferme le dialogue (APG)', async ({ page }) => {
  await signIn(page, ADMIN_USER);
  await gotoPlanning(page);

  await page.locator('.cal__cell--has').first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /\+ ajouter un rdv/i }).click();

  // Le 1er créneau (1er champ du sous-formulaire) reçoit le focus après rendu (L-006).
  const slot = dialog.getByRole('radiogroup', { name: /créneaux disponibles/i }).getByRole('radio').first();
  await expect(slot).toBeFocused();

  // Échap referme le dialogue entier (et donc le sous-formulaire).
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

// ── Balayage axe : /planning × deux thèmes, navbar scrollée (verre) ─────────────
const themes = [
  { id: 'light', libelle: 'thème clair' },
  { id: 'dark', libelle: 'thème sombre' },
] as const;

for (const theme of themes) {
  test(`/planning — aucune violation WCAG AA (${theme.libelle}, navbar scrollée)`, async ({
    page,
  }) => {
    // Connexion en ADMIN : scanne aussi le formulaire d'heures éditable (inputs/boutons —
    // surface nouvelle à plus fort risque de contraste/nom accessible que la lecture seule).
    await signIn(page, ADMIN_USER);
    await forceTheme(page, theme.id);
    await gotoPlanning(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.id);
    await expect(page.locator('.cal__cell--has').first()).toBeVisible();

    // Ouvre le dialogue jour pour scanner badges/chips de statut ET le formulaire d'heures.
    await page.locator('.cal__cell--has').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('group', { name: /heures de/i }).first()).toBeVisible();

    // Déploie le sous-formulaire d'ajout (US-11.2 p2) pour scanner sa nouvelle surface
    // (radiogroups créneaux/mode, recherche, champs adresse) dans les deux thèmes.
    await dialog.getByRole('button', { name: /\+ ajouter un rdv/i }).click();
    await expect(dialog.getByRole('radiogroup', { name: /créneaux disponibles/i })).toBeVisible();

    // Scroll → navbar en verre translucide (.navbar--scrolled), si la page défile.
    await page.evaluate(() => window.scrollTo(0, 300));

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(
      results.violations,
      JSON.stringify(
        results.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })),
        null,
        2,
      ),
    ).toEqual([]);
  });
}
