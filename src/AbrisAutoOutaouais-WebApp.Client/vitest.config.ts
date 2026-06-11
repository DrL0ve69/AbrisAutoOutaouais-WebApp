import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';
import { playwright } from '@vitest/browser-playwright';

// Tests unitaires/composants exécutés dans un VRAI navigateur (Chromium via Playwright).
// Remplace l'ancien environnement jsdom — indispensable pour tester la gestion du focus
// (pièges de focus des composants accessibles), que jsdom ne simule pas correctement.
export default defineConfig({
  plugins: [angular()],
  optimizeDeps: {
    include: ['axe-core'], // pré-bundle pour éviter un reload Vite pendant les tests
  },
  test: {
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['src/environments/**', 'src/main.ts', 'src/main.server.ts'],
    },
  },
});
