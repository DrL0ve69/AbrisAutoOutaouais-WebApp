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
    baseURL: 'http://127.0.0.1:4200',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm start',
    url: 'http://127.0.0.1:4200',
    reuseExistingServer: true,
    timeout: 180000,
  },
});
