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

test('Panneau « RDV du jour » — Enter ouvre + focus, Échap ferme + rend le focus (L-006)', async ({
  page,
}) => {
  await signIn(page, STAFF_USER);
  await gotoPlanning(page);

  const trigger = page.locator('[role="gridcell"][tabindex="0"]');
  await trigger.focus();
  await page.keyboard.press('Enter');

  // Le panneau (aside role="region") s'ouvre et reçoit le focus. On cible la classe :
  // son aria-label (« <date>, … rendez-vous ») partage le mot « rendez-vous » avec la
  // <section> « Calendrier des rendez-vous » → un getByRole par nom est ambigu (L-010).
  const panel = page.locator('aside.cal__panel');
  await expect(panel).toBeVisible();
  await expect(panel).toBeFocused();

  // Échap referme et rend le focus à la cellule déclencheuse (WCAG 2.4.3).
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
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

// ── Balayage axe : /planning × deux thèmes, navbar scrollée (verre) ─────────────
const themes = [
  { id: 'light', libelle: 'thème clair' },
  { id: 'dark', libelle: 'thème sombre' },
] as const;

for (const theme of themes) {
  test(`/planning — aucune violation WCAG AA (${theme.libelle}, navbar scrollée)`, async ({
    page,
  }) => {
    await signIn(page, STAFF_USER);
    await forceTheme(page, theme.id);
    await gotoPlanning(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.id);
    await expect(page.locator('.cal__cell--has').first()).toBeVisible();

    // Ouvre le panneau jour pour scanner aussi badges/chips de statut (pire cas contraste).
    await page.locator('[role="gridcell"][tabindex="0"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('aside.cal__panel')).toBeVisible();

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
