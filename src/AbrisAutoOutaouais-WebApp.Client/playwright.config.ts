import { defineConfig, devices } from '@playwright/test';

// Tests e2e d'accessibilité (axe-core) contre l'application RÉELLE servie par `ng serve`.
// Complète les tests axe au niveau composant (vitest) : ici tous les styles globaux sont
// chargés, ce qui permet de valider le contraste des couleurs et l'a11y pleine page.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    // Spécifications a11y + mécanisme du sélecteur, contre `ng serve` (fr only).
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4200' },
      testIgnore: '**/language-switch-i18n.spec.ts',
    },
    // Bascule i18n RÉELLE, contre l'hôte bilingue localisé (fr « / » + en « /en/ »).
    {
      name: 'i18n',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4300' },
      testMatch: '**/language-switch-i18n.spec.ts',
    },
  ],
  webServer: [
    {
      command: 'npm start',
      url: 'http://127.0.0.1:4200',
      reuseExistingServer: true,
      timeout: 180000,
    },
    {
      // Build localisé (fr + en) puis hôte bilingue — la bascule réelle exige les
      // deux builds servis ensemble, ce que `ng serve` ne peut pas faire.
      command: 'npm run build:i18n && node scripts/serve-i18n.mjs',
      url: 'http://127.0.0.1:4300',
      reuseExistingServer: true,
      timeout: 180000,
      env: { PORT: '4300' },
    },
  ],
});
