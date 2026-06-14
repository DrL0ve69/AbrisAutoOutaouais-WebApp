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
    // Scope le scan de dépendances aux SEULS fichiers de test. Par défaut, le scanner Vite
    // crawle tous les `*.html` du workspace comme points d'entrée — y compris les
    // `dist/**/index.server.html` produits par `build:prod` (lancé avant `npm test` en CI).
    // Il échouait alors à résoudre les bundles serveur hachés (« Failed to run dependency
    // scan »), ce qui faisait tomber par intermittence le test en cours (flake CI récurrent
    // sur `webgl.util.spec`, pourtant 100 % pur/déterministe). En épinglant les entrées aux
    // specs, le scan ignore complètement `dist/`.
    entries: ['src/**/*.spec.ts'],
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
