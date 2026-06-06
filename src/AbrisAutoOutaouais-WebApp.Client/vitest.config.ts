import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['src/environments/**', 'src/main.ts', 'src/main.server.ts'],
    },
  },
});
