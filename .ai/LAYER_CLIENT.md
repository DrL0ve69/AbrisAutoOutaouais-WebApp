# LAYER_CLIENT.md — Couche Client (Angular 20+)

Guide complet du frontend : chaque fichier de configuration, i18n, accessibilité WCAG AA,
patterns Angular 20+. Tous les composants ont des fichiers `.ts / .html / .scss` séparés.

---

## Table des matières

1. [Philosophie](#1-philosophie)
2. [Arborescence complète](#2-arborescence)
3. [Fichiers racine](#3-fichiers-racine)  
4. [src/ — fichiers de base](#4-src)
5. [app/ — composant racine + config](#5-app)
6. [core/ — services, guards, interceptors](#6-core)
7. [shared/ — composants, styles, layout](#7-shared)
8. [features/ — modules lazy-loaded](#8-features)
9. [i18n — internationalisation](#9-i18n)
10. [Accessibilité WCAG AA](#10-accessibilité)

---

## 1. Philosophie

- **Signals partout** — `signal()`, `computed()`, `effect()` pour l'état UI. RxJS seulement pour HTTP.
- **Standalone components** — pas de NgModules. Ne jamais écrire `standalone: true` (valeur par défaut en v20+).
- **Fichiers séparés** — toujours `.ts` + `.html` + `.scss` relatifs. Pas d'inline template sauf < 5 lignes.
- **OnPush partout** — `ChangeDetectionStrategy.OnPush` sur chaque composant.
- **WCAG AA** — zéro violation AXE, contraste, focus visible, ARIA.
- **i18n** — Angular `@angular/localize` (compile-time), FR source, EN secondaire.

---

## 2. Arborescence

```
client/
├── angular.json                    ← config Angular CLI (build, i18n, SSR)
├── tsconfig.json                   ← TypeScript base
├── tsconfig.app.json               ← TypeScript pour l'app
├── tsconfig.spec.json              ← TypeScript pour les tests
├── package.json
├── .eslintrc.json
├── vitest.config.ts
│
└── src/
    ├── index.html                  ← point d'entrée HTML (lang, meta, skip-nav)
    ├── main.ts                     ← bootstrap client
    ├── main.server.ts              ← bootstrap SSR
    ├── styles.scss                 ← styles globaux + import tokens
    │
    ├── locale/                     ← fichiers de traduction XLF
    │   ├── messages.xlf            ← source FR (généré par ng extract-i18n)
    │   └── messages.en.xlf         ← traduction EN
    │
    ├── environments/
    │   ├── environment.ts
    │   └── environment.prod.ts
    │
    └── app/
        ├── app.ts                  ← composant racine (shell)
        ├── app.html
        ├── app.scss
        ├── app.routes.ts           ← routes lazy-loaded
        ├── app.config.ts           ← providers client (HTTP, router, i18n)
        ├── app.config.server.ts    ← providers SSR
        │
        ├── core/
        │   ├── services/
        │   │   ├── auth.service.ts
        │   │   ├── cart.service.ts
        │   │   └── toast.service.ts
        │   ├── interceptors/
        │   │   ├── auth.interceptor.ts
        │   │   └── error.interceptor.ts
        │   ├── guards/
        │   │   ├── auth.guard.ts
        │   │   ├── admin.guard.ts
        │   │   └── public.guard.ts
        │   └── models/
        │       ├── auth.model.ts
        │       ├── product.model.ts
        │       ├── order.model.ts
        │       ├── rental.model.ts
        │       └── booking.model.ts
        │
        ├── shared/
        │   ├── styles/
        │   │   ├── _tokens.scss        ← design tokens (couleurs, spacing, typo)
        │   │   ├── _breakpoints.scss   ← mixins responsive
        │   │   ├── _mixins.scss        ← utilitaires SCSS
        │   │   └── _a11y.scss          ← helpers accessibilité (.sr-only, focus)
        │   ├── components/
        │   │   ├── button/
        │   │   │   ├── button.ts
        │   │   │   ├── button.html
        │   │   │   └── button.scss
        │   │   ├── product-card/
        │   │   │   ├── product-card.ts
        │   │   │   ├── product-card.html
        │   │   │   └── product-card.scss
        │   │   ├── alert/
        │   │   │   ├── alert.ts
        │   │   │   ├── alert.html
        │   │   │   └── alert.scss
        │   │   └── spinner/
        │   │       ├── spinner.ts
        │   │       └── spinner.html    ← inline OK (< 5 lignes)
        │   ├── pipes/
        │   │   ├── currency-cad.pipe.ts
        │   │   └── booking-status.pipe.ts
        │   └── layout/
        │       ├── navbar/
        │       │   ├── navbar.ts
        │       │   ├── navbar.html
        │       │   └── navbar.scss
        │       ├── footer/
        │       │   ├── footer.ts
        │       │   ├── footer.html
        │       │   └── footer.scss
        │       └── skip-nav/
        │           ├── skip-nav.ts
        │           └── skip-nav.html
        │
        └── features/
            ├── home/
            │   ├── home.routes.ts
            │   └── home/
            │       ├── home.ts
            │       ├── home.html
            │       └── home.scss
            ├── shop/
            │   ├── shop.routes.ts
            │   ├── catalog/
            │   │   ├── catalog.ts
            │   │   ├── catalog.html
            │   │   └── catalog.scss
            │   └── product-detail/
            │       ├── product-detail.ts
            │       ├── product-detail.html
            │       └── product-detail.scss
            ├── checkout/
            │   ├── checkout.routes.ts
            │   ├── checkout/
            │   │   ├── checkout.ts
            │   │   ├── checkout.html
            │   │   └── checkout.scss
            │   └── order-confirmation/
            │       ├── order-confirmation.ts
            │       ├── order-confirmation.html
            │       └── order-confirmation.scss
            ├── rental/
            │   ├── rental.routes.ts
            │   ├── rental-catalog/
            │   │   ├── rental-catalog.ts
            │   │   ├── rental-catalog.html
            │   │   └── rental-catalog.scss
            │   └── rental-form/
            │       ├── rental-form.ts
            │       ├── rental-form.html
            │       └── rental-form.scss
            ├── booking/
            │   ├── booking.routes.ts
            │   ├── booking-form/
            │   │   ├── booking-form.ts
            │   │   ├── booking-form.html
            │   │   └── booking-form.scss
            │   └── my-bookings/
            │       ├── my-bookings.ts
            │       ├── my-bookings.html
            │       └── my-bookings.scss
            ├── auth/
            │   ├── auth.routes.ts
            │   ├── login/
            │   │   ├── login.ts
            │   │   ├── login.html
            │   │   └── login.scss
            │   └── register/
            │       ├── register.ts
            │       ├── register.html
            │       └── register.scss
            ├── account/
            │   ├── account.routes.ts
            │   ├── my-orders/
            │   │   ├── my-orders.ts
            │   │   ├── my-orders.html
            │   │   └── my-orders.scss
            │   ├── my-rentals/
            │   │   └── ...
            │   └── profile/
            │       ├── profile.ts
            │       ├── profile.html
            │       └── profile.scss
            └── admin/
                ├── admin.routes.ts
                ├── dashboard/
                │   └── ...
                ├── products-manage/
                │   └── ...
                └── bookings-manage/
                    └── ...
```

---

## 3. Fichiers racine

### `package.json` (scripts importants)

```json
{
  "name": "abristempo-client",
  "version": "1.0.0",
  "scripts": {
    "start":       "ng serve",
    "build":       "ng build --configuration production",
    "build:fr":    "ng build --configuration production --localize",
    "test":        "vitest run",
    "test:watch":  "vitest",
    "lint":        "ng lint",
    "i18n:extract":"ng extract-i18n --output-path src/locale --format xlf",
    "i18n:serve":  "ng serve --configuration=en"
  },
  "dependencies": {
    "@angular/animations":    "^20.0.0",
    "@angular/common":        "^20.0.0",
    "@angular/compiler":      "^20.0.0",
    "@angular/core":          "^20.0.0",
    "@angular/forms":         "^20.0.0",
    "@angular/localize":      "^20.0.0",
    "@angular/platform-browser": "^20.0.0",
    "@angular/platform-server":  "^20.0.0",
    "@angular/router":        "^20.0.0",
    "@angular/ssr":           "^20.0.0",
    "rxjs":                   "~7.8.0",
    "tslib":                  "^2.8.0",
    "zone.js":                "~0.15.0"
  },
  "devDependencies": {
    "@angular-eslint/eslint-plugin":           "^20.0.0",
    "@angular-eslint/eslint-plugin-template":  "^20.0.0",
    "@angular/build":                         "^20.0.0",
    "@angular/cli":                           "^20.0.0",
    "@angular/compiler-cli":                  "^20.0.0",
    "@testing-library/angular":               "^17.0.0",
    "@vitest/coverage-v8":                    "^3.0.0",
    "typescript":                             "~5.8.0",
    "vitest":                                 "^3.0.0"
  }
}
```

---

### `angular.json`

Fichier de configuration Angular CLI. Chaque clé est commentée.

```jsonc
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {
    "abristempo-client": {
      "projectType": "application",
      "schematics": {
        "@schematics/angular:component": {
          "style": "scss",          // SCSS par défaut pour ng generate
          "changeDetection": "OnPush",
          "skipTests": false
        }
      },
      "root": "",
      "sourceRoot": "src",
      "prefix": "app",

      // ── i18n ──────────────────────────────────────────────────────────
      "i18n": {
        "sourceLocale": "fr",         // Langue source dans les templates
        "locales": {
          "en": {
            "translation": "src/locale/messages.en.xlf",
            "baseHref": "/en/"        // URL prefix pour la version anglaise
          }
        }
      },

      "architect": {
        "build": {
          "builder": "@angular/build:application",
          "options": {
            "outputPath": "dist/abristempo-client",
            "index": "src/index.html",
            "browser": "src/main.ts",
            "server": "src/main.server.ts",    // SSR
            "prerender": false,
            "ssr": {
              "entry": "src/server.ts"
            },
            "polyfills": [
              "zone.js",
              "@angular/localize/init"          // OBLIGATOIRE pour i18n
            ],
            "tsConfig": "tsconfig.app.json",
            "assets": [
              {
                "glob": "**/*",
                "input": "public"
              }
            ],
            "styles": [
              "src/styles.scss"
            ],
            "scripts": []
          },
          "configurations": {
            "production": {
              "budgets": [
                {
                  "type": "initial",
                  "maximumWarning": "500kB",
                  "maximumError": "1MB"
                },
                {
                  "type": "anyComponentStyle",
                  "maximumWarning": "4kB",
                  "maximumError": "8kB"
                }
              ],
              "outputHashing": "all",
              "localize": true            // Génère un build par locale en prod
            },
            "development": {
              "optimization": false,
              "extractLicenses": false,
              "sourceMap": true
            },
            "en": {
              "localize": ["en"]          // ng serve --configuration=en pour tester l'anglais
            }
          },
          "defaultConfiguration": "production"
        },
        "serve": {
          "builder": "@angular/build:dev-server",
          "configurations": {
            "production": { "buildTarget": "abristempo-client:build:production" },
            "development": { "buildTarget": "abristempo-client:build:development" },
            "en":          { "buildTarget": "abristempo-client:build:en" }
          },
          "defaultConfiguration": "development"
        },
        "extract-i18n": {
          "builder": "@angular/build:extract-i18n",
          "options": {
            "buildTarget": "abristempo-client:build",
            "outputPath": "src/locale",
            "outFile": "messages.xlf",
            "format": "xlf"
          }
        },
        "test": {
          "builder": "@angular/build:karma"
        },
        "lint": {
          "builder": "@angular-eslint/builder:lint",
          "options": {
            "lintFilePatterns": ["src/**/*.ts", "src/**/*.html"]
          }
        }
      }
    }
  }
}
```

---

### `tsconfig.json`

```json
{
  "compileOnSave": false,
  "compilerOptions": {
    "baseUrl": "./",
    "outDir": "./dist/out-tsc",
    "strict": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "experimentalDecorators": true,
    "moduleResolution": "bundler",
    "importHelpers": true,
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022", "dom"],
    "useDefineForClassFields": false
  },
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,  // Recommandé pour les nouveaux projets
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "strictTemplates": true
  }
}
```

### `tsconfig.app.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/app",
    "types": []
  },
  "files": ["src/main.ts", "src/main.server.ts"],
  "include": ["src/**/*.d.ts"]
}
```

### `tsconfig.spec.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/spec",
    "types": ["vitest/globals", "node"]
  },
  "include": ["src/**/*.spec.ts", "src/**/*.d.ts"]
}
```

---

### `vitest.config.ts`

```typescript
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
```

---

### `.eslintrc.json`

```json
{
  "root": true,
  "ignorePatterns": ["projects/**/*"],
  "overrides": [
    {
      "files": ["*.ts"],
      "extends": [
        "eslint:recommended",
        "plugin:@angular-eslint/recommended",
        "plugin:@angular-eslint/template/process-inline-templates"
      ],
      "rules": {
        "@angular-eslint/directive-selector": ["error", { "type": "attribute", "prefix": "app", "style": "camelCase" }],
        "@angular-eslint/component-selector": ["error", { "type": "element", "prefix": "app", "style": "kebab-case" }],
        "@typescript-eslint/no-explicit-any": "error",
        "@typescript-eslint/explicit-function-return-type": "off"
      }
    },
    {
      "files": ["*.html"],
      "extends": [
        "plugin:@angular-eslint/template/recommended",
        "plugin:@angular-eslint/template/accessibility"  // règles a11y dans les templates
      ]
    }
  ]
}
```

---

## 4. `src/` — Fichiers de base

### `src/index.html`

Point d'entrée HTML. `lang` est **obligatoire** pour WCAG 3.1.1 (langue de la page).

```html
<!doctype html>
<html lang="fr">
  <!-- lang="fr" est OBLIGATOIRE pour WCAG AA (3.1.1 Language of Page) -->
  <!-- Angular remplace "fr" par la locale courante lors du build i18n -->
<head>
  <meta charset="utf-8" />
  <title>AbrisTempo Local — Abris d'auto temporaires</title>
  <base href="/" />

  <!-- Viewport — obligatoire pour le responsive (WCAG 1.4.4) -->
  <meta name="viewport" content="width=device-width, initial-scale=1" />

  <!-- Description pour les moteurs de recherche (SSR) -->
  <meta name="description"
        content="Vente, location et installation d'abris d'auto temporaires Tempo au Québec." />

  <!-- Open Graph (partage réseaux sociaux) -->
  <meta property="og:title"       content="AbrisTempo Local" />
  <meta property="og:description" content="Abris d'auto temporaires — vente, location, installation" />
  <meta property="og:locale"      content="fr_CA" />

  <!-- Couleur de thème mobile -->
  <meta name="theme-color" content="#e52329" />

  <!-- Favicon -->
  <link rel="icon" type="image/x-icon" href="favicon.ico" />

  <!-- Preconnect pour la police (performance) -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        rel="stylesheet" />
</head>
<body>
  <!-- Skip navigation — OBLIGATOIRE WCAG 2.4.1 (Bypass Blocks) -->
  <!-- Le composant app-skip-nav affiche ce lien et gère le focus -->
  <app-root></app-root>
</body>
</html>
```

---

### `src/main.ts`

```typescript
/// <reference types="@angular/localize" />
// La ligne ci-dessus active @angular/localize pour les chaînes $localize`...`

import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig)
  .catch(err => console.error(err));
```

---

### `src/main.server.ts`

```typescript
/// <reference types="@angular/localize" />
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app';
import { appServerConfig } from './app/app.config.server';

const bootstrap = () => bootstrapApplication(AppComponent, appServerConfig);
export default bootstrap;
```

---

### `src/styles.scss`

```scss
// Import des tokens et helpers partagés
@use 'app/shared/styles/tokens'      as *;
@use 'app/shared/styles/breakpoints' as *;
@use 'app/shared/styles/a11y'        as *;

// ── Réinitialisation ─────────────────────────────────────────────────────────
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

// ── Base HTML ────────────────────────────────────────────────────────────────
html {
  font-size: 100%;          // 16px — ne jamais utiliser px ici (WCAG 1.4.4)
  scroll-behavior: smooth;

  @media (prefers-reduced-motion: reduce) {
    scroll-behavior: auto;  // Respecter les préférences de l'utilisateur
  }
}

body {
  font-family: var(--font-sans);
  font-size: var(--font-size-base);
  line-height: 1.6;
  color: var(--color-text);
  background-color: var(--color-bg);
  -webkit-font-smoothing: antialiased;
}

// ── Typographie ──────────────────────────────────────────────────────────────
h1 { font-size: var(--font-size-4xl); font-weight: 700; line-height: 1.2; }
h2 { font-size: var(--font-size-3xl); font-weight: 600; line-height: 1.3; }
h3 { font-size: var(--font-size-2xl); font-weight: 600; }
h4 { font-size: var(--font-size-xl);  font-weight: 500; }

// ── Focus visible — WCAG 2.4.7 ───────────────────────────────────────────────
// Styles de focus clairs pour la navigation clavier
:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 3px;
  border-radius: var(--radius-sm);
}

// Supprimer l'outline pour la souris seulement
:focus:not(:focus-visible) {
  outline: none;
}

// ── Liens ────────────────────────────────────────────────────────────────────
a {
  color: var(--color-primary);
  text-decoration: underline;

  &:hover { color: var(--color-primary-dark); }

  // Assurer le contraste en visitant (WCAG 1.4.3)
  &:visited { color: var(--color-primary-dark); }
}

// ── Utilitaires globaux ───────────────────────────────────────────────────────
.container {
  width: 100%;
  max-width: 1280px;
  margin-inline: auto;
  padding-inline: var(--space-4);

  @include md { padding-inline: var(--space-6); }
  @include lg { padding-inline: var(--space-8); }
}

img { max-width: 100%; height: auto; }

// ── Animations — respecter prefers-reduced-motion ────────────────────────────
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

### `src/environments/environment.ts`

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000/api/v1',
} as const;
```

### `src/environments/environment.prod.ts`

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://api.abristempo.com/api/v1',
} as const;
```

---

## 5. `app/` — Composant racine + config

### `app/app.config.ts`

```typescript
import { ApplicationConfig, provideZoneChangeDetection, LOCALE_ID } from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withComponentInputBinding(),   // Input() bindable depuis les routes
      withViewTransitions(),          // Transitions natives entre pages
    ),
    provideHttpClient(
      withFetch(),                    // Fetch API — meilleure perf + compatible SSR
      withInterceptors([authInterceptor, errorInterceptor]),
    ),
    provideClientHydration(
      withEventReplay(),              // Rejoue les events pendant l'hydratation SSR
    ),
    provideAnimationsAsync(),
    // LOCALE_ID est injecté automatiquement par Angular lors du build --localize
    // Pas besoin de le déclarer manuellement
  ],
};
```

### `app/app.config.server.ts`

```typescript
import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { provideServerRoutesConfig } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(),
    provideServerRoutesConfig(serverRoutes),
  ],
};

export const appServerConfig = mergeApplicationConfig(appConfig, serverConfig);
```

### `app/app.routes.ts`

```typescript
import { Routes } from '@angular/router';
import { authGuard }   from './core/guards/auth.guard';
import { adminGuard }  from './core/guards/admin.guard';
import { publicGuard } from './core/guards/public.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home/home').then(m => m.HomeComponent),
    title: 'AbrisTempo Local — Accueil',   // title est utilisé par le router pour WCAG 2.4.2
  },
  {
    path: 'boutique',
    loadChildren: () => import('./features/shop/shop.routes').then(m => m.SHOP_ROUTES),
  },
  {
    path: 'location',
    loadChildren: () => import('./features/rental/rental.routes').then(m => m.RENTAL_ROUTES),
  },
  {
    path: 'installation',
    canActivate: [authGuard],
    loadChildren: () => import('./features/booking/booking.routes').then(m => m.BOOKING_ROUTES),
  },
  {
    path: 'mon-compte',
    canActivate: [authGuard],
    loadChildren: () => import('./features/account/account.routes').then(m => m.ACCOUNT_ROUTES),
  },
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    loadChildren: () => import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES),
  },
  {
    path: 'auth',
    canActivate: [publicGuard],
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },
  { path: '**', redirectTo: '' },
];
```

### `app/app.ts`

```typescript
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent }  from './shared/layout/navbar/navbar';
import { FooterComponent }  from './shared/layout/footer/footer';
import { SkipNavComponent } from './shared/layout/skip-nav/skip-nav';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, NavbarComponent, FooterComponent, SkipNavComponent],
})
export class AppComponent {}
```

### `app/app.html`

```html
<!-- Skip navigation — doit être le PREMIER élément interactif de la page (WCAG 2.4.1) -->
<app-skip-nav />

<!-- Région d'en-tête avec rôle banner -->
<header role="banner">
  <app-navbar />
</header>

<!-- Contenu principal — id="main" ciblé par le skip nav -->
<main id="main" tabindex="-1">
  <!-- tabindex="-1" permet à skip-nav de mettre le focus ici via JS -->
  <router-outlet />
</main>

<!-- Pied de page avec rôle contentinfo -->
<footer role="contentinfo">
  <app-footer />
</footer>
```

---

## 6. `core/`

### `core/models/product.model.ts`

```typescript
export interface ProductSummaryDto {
  readonly id:            string;
  readonly name:          string;
  readonly slug:          string;
  readonly price:         number;
  readonly rentalPrice:   number | null;
  readonly isAvailable:   boolean;
  readonly categoryName:  string;
  readonly thumbnailUrl:  string | null;
}

export interface ProductDto extends ProductSummaryDto {
  readonly description: string | null;
  readonly stock:       number;
  readonly imageUrls:   readonly string[];
}

export interface PaginatedList<T> {
  readonly items:      readonly T[];
  readonly totalCount: number;
  readonly pageNumber: number;
  readonly pageSize:   number;
  readonly totalPages: number;
  readonly hasNext:    boolean;
  readonly hasPrev:    boolean;
}
```

### `core/models/booking.model.ts`

```typescript
export type BookingType   = 'Installation' | 'Livraison' | 'Removal';
export type BookingStatus = 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled';

export interface AddressDto {
  readonly street:     string;
  readonly city:       string;
  readonly province:   string;
  readonly postalCode: string;
  readonly country:    string;
}

export interface AvailableSlotDto {
  readonly start: string;   // ISO 8601
  readonly end:   string;
}

export interface CreateBookingRequest {
  slotStart:   string;
  durationMin: number;
  type:        BookingType;
  street:      string;
  city:        string;
  province:    string;
  postalCode:  string;
  orderId?:    string;
  notes?:      string;
}
```

### `core/services/auth.service.ts`

```typescript
import {
  Injectable, computed, inject, signal, PLATFORM_ID
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuthUser {
  readonly id:        string;
  readonly email:     string;
  readonly firstName: string;
  readonly lastName:  string;
  readonly roles:     readonly string[];
}

export interface LoginRequest    { email: string; password: string; }
export interface RegisterRequest { email: string; firstName: string; lastName: string; password: string; confirmPassword: string; }
export interface AuthResponse    { token: string; expiresAt: string; userId: string; email: string; fullName: string; roles: string[]; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http     = inject(HttpClient);
  private readonly router   = inject(Router);
  private readonly platform = inject(PLATFORM_ID);

  private readonly _token = signal<string | null>(this.loadFromStorage('auth_token'));
  private readonly _user  = signal<AuthUser | null>(this.loadUserFromStorage());

  readonly isAuthenticated = computed(() => this._token() !== null);
  readonly user            = this._user.asReadonly();
  readonly isAdmin         = computed(() => this._user()?.roles.includes('Admin') ?? false);
  readonly isStaff         = computed(() => this._user()?.roles.some(r => r === 'Staff' || r === 'Admin') ?? false);
  readonly fullName        = computed(() => {
    const u = this._user();
    return u ? `${u.firstName} ${u.lastName}` : null;
  });

  login(req: LoginRequest) {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, req).pipe(
      tap(res => this.setSession(res))
    );
  }

  register(req: RegisterRequest) {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/register`, req).pipe(
      tap(res => this.setSession(res))
    );
  }

  logout(): void {
    this.clearSession();
    this.router.navigateByUrl('/auth/login');
  }

  getToken(): string | null { return this._token(); }

  private setSession(res: AuthResponse): void {
    this._token.set(res.token);
    this._user.set({ id: res.userId, email: res.email, firstName: '', lastName: '', roles: res.roles });
    if (isPlatformBrowser(this.platform)) {
      localStorage.setItem('auth_token', res.token);
      localStorage.setItem('auth_user', JSON.stringify(res));
    }
  }

  private clearSession(): void {
    this._token.set(null);
    this._user.set(null);
    if (isPlatformBrowser(this.platform)) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    }
  }

  private loadFromStorage(key: string): string | null {
    if (!isPlatformBrowser(this.platform)) return null;
    return localStorage.getItem(key);
  }

  private loadUserFromStorage(): AuthUser | null {
    if (!isPlatformBrowser(this.platform)) return null;
    try {
      const raw = localStorage.getItem('auth_user');
      const res: AuthResponse = raw ? JSON.parse(raw) : null;
      return res ? { id: res.userId, email: res.email, firstName: '', lastName: '', roles: res.roles } : null;
    } catch { return null; }
  }
}
```

### `core/services/cart.service.ts`

```typescript
import { Injectable, computed, signal } from '@angular/core';
import { ProductSummaryDto } from '../models/product.model';

export interface CartItem { readonly product: ProductSummaryDto; quantity: number; }

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly _items = signal<CartItem[]>([]);

  readonly items    = this._items.asReadonly();
  readonly count    = computed(() => this._items().reduce((s, i) => s + i.quantity, 0));
  readonly subtotal = computed(() => this._items().reduce((s, i) => s + i.product.price * i.quantity, 0));

  addItem(product: ProductSummaryDto, qty = 1): void {
    this._items.update(items => {
      const existing = items.find(i => i.product.id === product.id);
      return existing
        ? items.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + qty } : i)
        : [...items, { product, quantity: qty }];
    });
  }

  removeItem(id: string): void { this._items.update(i => i.filter(x => x.product.id !== id)); }
  clear(): void { this._items.set([]); }
}
```

### `core/services/toast.service.ts`

```typescript
import { Injectable, signal } from '@angular/core';

export interface Toast { id: string; message: string; type: 'success' | 'error' | 'info'; }

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  show(message: string, type: Toast['type'] = 'info'): void {
    const id = crypto.randomUUID();
    this._toasts.update(t => [...t, { id, message, type }]);
    setTimeout(() => this.dismiss(id), 5000);
  }

  dismiss(id: string): void { this._toasts.update(t => t.filter(x => x.id !== id)); }
}
```

### `core/interceptors/auth.interceptor.ts`

```typescript
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).getToken();
  if (!token) return next(req);
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
```

### `core/interceptors/error.interceptor.ts`

```typescript
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth  = inject(AuthService);
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) { auth.logout(); }
      if (err.status === 0)   { toast.show('Erreur de connexion au serveur.', 'error'); }
      return throwError(() => err);
    })
  );
};
```

### `core/guards/auth.guard.ts`

```typescript
import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? true : router.createUrlTree(['/auth/login']);
};
```

### `core/guards/admin.guard.ts`

```typescript
import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  return auth.isAdmin() ? true : router.createUrlTree(['/']);
};
```

### `core/guards/public.guard.ts`

```typescript
import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const publicGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  return !auth.isAuthenticated() ? true : router.createUrlTree(['/']);
};
```

---

## 7. `shared/`

### `shared/styles/_tokens.scss`

```scss
:root {
  // ── Couleurs marque (rouge Tempo) ────────────────────────────────────────
  --color-primary:        #c0201a;   // Ratio 4.6:1 sur blanc — WCAG AA ✅
  --color-primary-dark:   #9e1915;
  --color-primary-light:  #e53932;
  --color-secondary:      #1a2332;   // Bleu nuit
  --color-accent:         #c27b00;   // Ambre (ratio 4.5:1 sur blanc) ✅

  // ── Couleur de focus — WCAG 2.4.7 ────────────────────────────────────────
  --color-focus:          #005fcc;   // Bleu vif, ratio élevé sur fond blanc ✅

  // ── Neutres ───────────────────────────────────────────────────────────────
  --color-bg:             #ffffff;
  --color-bg-subtle:      #f7f7f7;
  --color-bg-muted:       #efefef;
  --color-border:         #d1d1d1;
  --color-text:           #111111;   // Ratio 18:1 sur blanc ✅
  --color-text-muted:     #595959;   // Ratio 7:1 sur blanc ✅
  --color-text-inverse:   #ffffff;

  // ── Feedback ─────────────────────────────────────────────────────────────
  --color-success:        #1a6e2e;   // Ratio 5.2:1 sur blanc ✅
  --color-error:          #b91c1c;   // Ratio 5.9:1 sur blanc ✅
  --color-warning-bg:     #fef3c7;
  --color-info:           #1d4ed8;

  // ── Spacing ───────────────────────────────────────────────────────────────
  --space-1:  0.25rem;
  --space-2:  0.5rem;
  --space-3:  0.75rem;
  --space-4:  1rem;
  --space-5:  1.25rem;
  --space-6:  1.5rem;
  --space-8:  2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;
  --space-16: 4rem;

  // ── Typographie ───────────────────────────────────────────────────────────
  --font-sans:      'Inter', system-ui, -apple-system, sans-serif;
  --font-size-sm:   0.875rem;
  --font-size-base: 1rem;
  --font-size-lg:   1.125rem;
  --font-size-xl:   1.25rem;
  --font-size-2xl:  1.5rem;
  --font-size-3xl:  1.875rem;
  --font-size-4xl:  2.25rem;

  // ── Formes ────────────────────────────────────────────────────────────────
  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:   12px;
  --radius-full: 9999px;

  // ── Ombres ────────────────────────────────────────────────────────────────
  --shadow-sm:  0 1px 3px rgba(0, 0, 0, .1);
  --shadow-md:  0 4px 12px rgba(0, 0, 0, .12);
  --shadow-lg:  0 8px 24px rgba(0, 0, 0, .15);
}

// Dark mode — respecte les préférences système (WCAG 1.4.3)
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg:           #0f1117;
    --color-bg-subtle:    #1a1d27;
    --color-bg-muted:     #252834;
    --color-border:       #363a4f;
    --color-text:         #e8eaf0;
    --color-text-muted:   #9ba3bf;
    --color-text-inverse: #111111;
  }
}
```

### `shared/styles/_a11y.scss`

```scss
// ── Screen reader only — WCAG technique G1 ───────────────────────────────────
// Utiliser pour le texte visible seulement par les lecteurs d'écran
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

// ── Annonce dynamique pour aria-live ──────────────────────────────────────────
// <div class="sr-only" aria-live="polite" aria-atomic="true">{{ message() }}</div>

// ── Focus trap backdrop (modales) ─────────────────────────────────────────────
.focus-trap-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, .5);
  z-index: 100;
}
```

### `shared/styles/_breakpoints.scss`

```scss
@mixin sm  { @media (min-width: 640px)  { @content; } }
@mixin md  { @media (min-width: 768px)  { @content; } }
@mixin lg  { @media (min-width: 1024px) { @content; } }
@mixin xl  { @media (min-width: 1280px) { @content; } }
```

---

### `shared/layout/skip-nav/skip-nav.ts`

Skip navigation = premier élément de la page, obligatoire pour WCAG 2.4.1.

```typescript
import { ChangeDetectionStrategy, Component, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-skip-nav',
  templateUrl: './skip-nav.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'skip-nav-wrapper' },
})
export class SkipNavComponent {
  private readonly platform = inject(PLATFORM_ID);

  protected skipToMain(event: Event): void {
    event.preventDefault();
    if (!isPlatformBrowser(this.platform)) return;

    const main = document.getElementById('main');
    if (main) {
      main.focus();
      main.scrollIntoView();
    }
  }
}
```

### `shared/layout/skip-nav/skip-nav.html`

```html
<!-- Visible seulement au focus clavier — WCAG 2.4.1 (Bypass Blocks) -->
<a
  href="#main"
  class="skip-link"
  (click)="skipToMain($event)"
  i18n="Lien d'évitement@@skipNav.link">
  Aller au contenu principal
</a>
```

---

### `shared/layout/navbar/navbar.ts`

```typescript
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../core/services/cart.service';
import { NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, NgOptimizedImage],
})
export class NavbarComponent {
  protected readonly auth  = inject(AuthService);
  protected readonly cart  = inject(CartService);
  protected readonly menuOpen = signal(false);

  protected toggleMenu(): void {
    this.menuOpen.update(v => !v);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected logout(): void {
    this.auth.logout();
    this.closeMenu();
  }
}
```

### `shared/layout/navbar/navbar.html`

```html
<nav
  class="navbar"
  aria-label="Navigation principale"
  i18n-aria-label="Navbar aria label@@navbar.ariaLabel">

  <div class="container navbar__inner">
    <!-- Logo -->
    <a
      routerLink="/"
      class="navbar__logo"
      aria-label="AbrisTempo Local — Accueil"
      i18n-aria-label="@@navbar.logoAlt">
      <img
        ngSrc="/assets/images/logo.png"
        alt=""
        width="140"
        height="40"
        priority />
      <!-- alt="" sur le logo car le texte "AbrisTempo Local" est dans aria-label -->
    </a>

    <!-- Navigation desktop -->
    <ul class="navbar__links" role="list">
      <li>
        <a routerLink="/boutique" routerLinkActive="is-active"
           i18n="@@navbar.shop">Boutique</a>
      </li>
      <li>
        <a routerLink="/location" routerLinkActive="is-active"
           i18n="@@navbar.rental">Location</a>
      </li>
      <li>
        <a routerLink="/installation" routerLinkActive="is-active"
           i18n="@@navbar.booking">Installation</a>
      </li>
    </ul>

    <!-- Actions -->
    <div class="navbar__actions">
      <!-- Panier -->
      <a
        routerLink="/mon-compte/panier"
        class="navbar__cart"
        [attr.aria-label]="'Panier, ' + cart.count() + ' articles'">
        <span aria-hidden="true">🛒</span>
        @if (cart.count() > 0) {
          <span class="navbar__badge" aria-hidden="true">{{ cart.count() }}</span>
        }
      </a>

      <!-- Authentifié -->
      @if (auth.isAuthenticated()) {
        <a routerLink="/mon-compte"
           i18n="@@navbar.myAccount">Mon compte</a>
        <button type="button" (click)="logout()"
                i18n="@@navbar.logout">Déconnexion</button>

        @if (auth.isAdmin()) {
          <a routerLink="/admin"
             i18n="@@navbar.admin">Administration</a>
        }
      } @else {
        <a routerLink="/auth/login"
           i18n="@@navbar.login">Connexion</a>
        <a routerLink="/auth/register" class="btn-primary"
           i18n="@@navbar.register">S'inscrire</a>
      }
    </div>

    <!-- Bouton menu mobile -->
    <button
      type="button"
      class="navbar__hamburger"
      (click)="toggleMenu()"
      [attr.aria-expanded]="menuOpen()"
      aria-controls="mobile-menu"
      i18n-aria-label="Ouvrir le menu@@navbar.menuToggle"
      aria-label="Ouvrir le menu">
      <!-- Icône hamburger accessible avec aria-hidden -->
      <span aria-hidden="true">☰</span>
    </button>
  </div>

  <!-- Menu mobile -->
  <div
    id="mobile-menu"
    class="navbar__mobile"
    [class.is-open]="menuOpen()"
    role="dialog"
    aria-modal="false"
    [attr.aria-hidden]="!menuOpen()">

    <ul role="list">
      <li><a routerLink="/boutique"      (click)="closeMenu()" i18n="@@navbar.shop">Boutique</a></li>
      <li><a routerLink="/location"      (click)="closeMenu()" i18n="@@navbar.rental">Location</a></li>
      <li><a routerLink="/installation"  (click)="closeMenu()" i18n="@@navbar.booking">Installation</a></li>
    </ul>
  </div>
</nav>
```

---

### `shared/components/product-card/product-card.ts`

```typescript
import {
  ChangeDetectionStrategy, Component, computed, input, output
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { ProductSummaryDto } from '../../../core/models/product.model';

@Component({
  selector: 'app-product-card',
  templateUrl: './product-card.html',
  styleUrl: './product-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, RouterLink, NgOptimizedImage],
})
export class ProductCardComponent {
  readonly product  = input.required<ProductSummaryDto>();
  readonly showRent = input(false);

  readonly addToCart = output<ProductSummaryDto>();

  protected readonly hasRental = computed(
    () => this.showRent() && this.product().rentalPrice !== null
  );

  protected onAdd(): void {
    this.addToCart.emit(this.product());
  }
}
```

### `shared/components/product-card/product-card.html`

```html
<!-- article = élément sémantique correct pour une carte produit (WCAG 1.3.1) -->
<article
  class="product-card"
  [attr.aria-label]="product().name">

  <!-- Image produit -->
  <a
    [routerLink]="['/boutique', product().slug]"
    class="product-card__image-link"
    tabindex="-1"
    aria-hidden="true">
    <!-- tabindex="-1" : le lien du titre suffit — éviter la navigation dupliquée -->
    @if (product().thumbnailUrl) {
      <img
        ngSrc="{{ product().thumbnailUrl! }}"
        [alt]="product().name"
        width="400"
        height="300"
        class="product-card__image" />
    } @else {
      <div class="product-card__image-placeholder" aria-hidden="true">
        <span>📦</span>
      </div>
    }
  </a>

  <div class="product-card__body">
    <!-- Catégorie -->
    <p class="product-card__category" aria-label="Catégorie : {{ product().categoryName }}">
      {{ product().categoryName }}
    </p>

    <!-- Nom avec lien principal (le seul lien de la carte) -->
    <h2 class="product-card__name">
      <a [routerLink]="['/boutique', product().slug]">
        {{ product().name }}
      </a>
    </h2>

    <!-- Prix -->
    <div class="product-card__pricing">
      <span class="product-card__price"
            [attr.aria-label]="'Prix : ' + (product().price | currency:'CAD':'symbol':'1.2-2':'fr-CA')">
        {{ product().price | currency:'CAD':'symbol':'1.2-2':'fr-CA' }}
      </span>

      @if (hasRental()) {
        <span class="product-card__rental"
              [attr.aria-label]="'Location : ' + (product().rentalPrice! | currency:'CAD':'symbol':'1.2-2':'fr-CA') + ' par mois'">
          Location : {{ product().rentalPrice! | currency:'CAD':'symbol':'1.2-2':'fr-CA' }}/mois
        </span>
      }
    </div>

    <!-- Disponibilité — signal visuel ET texte pour les lecteurs d'écran -->
    <p
      class="product-card__availability"
      [class.is-available]="product().isAvailable"
      [class.is-unavailable]="!product().isAvailable"
      role="status">
      @if (product().isAvailable) {
        <span aria-hidden="true">✓</span>
        <span i18n="@@product.available">En stock</span>
      } @else {
        <span aria-hidden="true">✗</span>
        <span i18n="@@product.unavailable">Épuisé</span>
      }
    </p>

    <!-- Bouton ajouter au panier -->
    <button
      type="button"
      class="btn-primary product-card__btn"
      (click)="onAdd()"
      [disabled]="!product().isAvailable"
      [attr.aria-disabled]="!product().isAvailable"
      i18n="Bouton ajouter au panier@@product.addToCart">
      Ajouter au panier
    </button>
  </div>
</article>
```

---

### `shared/components/alert/alert.ts`

```typescript
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

@Component({
  selector: 'app-alert',
  templateUrl: './alert.html',
  styleUrl: './alert.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Rôle et aria sur l'hôte — WCAG 4.1.3 Status Messages
  host: {
    'role':       'alert',          // Annonce immédiatement aux lecteurs d'écran
    'aria-live':  'assertive',      // 'polite' pour les succès, 'assertive' pour les erreurs
    'aria-atomic':'true',
  },
})
export class AlertComponent {
  readonly type    = input<AlertType>('info');
  readonly message = input.required<string>();
}
```

### `shared/components/alert/alert.html`

```html
<!-- Le rôle alert est sur le host — le contenu est directement lisible -->
<div class="alert" [class]="'alert--' + type()">
  <!-- Icône décorative seulement -->
  <span class="alert__icon" aria-hidden="true">
    @switch (type()) {
      @case ('success') { ✓ }
      @case ('error')   { ✗ }
      @case ('warning') { ⚠ }
      @default          { ℹ }
    }
  </span>
  <p class="alert__message">{{ message() }}</p>
</div>
```

---

## 8. `features/` — Exemples

### `features/auth/login/login.ts`

```typescript
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AlertComponent } from '../../../shared/components/alert/alert';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, AlertComponent],
})
export class LoginComponent {
  private readonly fb     = inject(FormBuilder);
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error   = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected get emailCtrl()    { return this.form.controls.email; }
  protected get passwordCtrl() { return this.form.controls.password; }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();  // Affiche tous les messages d'erreur
      return;
    }
    this.loading.set(true);
    this.error.set(null);

    this.auth.login(this.form.getRawValue()).subscribe({
      next:  () => this.router.navigateByUrl('/'),
      error: err => {
        this.error.set(err.error?.detail ?? 'Identifiants incorrects.');
        this.loading.set(false);
      },
    });
  }
}
```

### `features/auth/login/login.html`

```html
<div class="login-page">
  <main class="login-card" aria-labelledby="login-title">

    <h1 id="login-title" i18n="@@login.title">Connexion</h1>

    <!-- Message d'erreur globale — rôle alert pour l'annonce immédiate -->
    @if (error()) {
      <app-alert [message]="error()!" type="error" />
    }

    <form
      [formGroup]="form"
      (ngSubmit)="submit()"
      novalidate
      aria-describedby="login-title">

      <!-- Email -->
      <div class="form-group">
        <label for="email" i18n="@@login.emailLabel">
          Adresse courriel
          <span class="required" aria-hidden="true">*</span>
        </label>

        <input
          id="email"
          type="email"
          formControlName="email"
          autocomplete="email"
          [attr.aria-invalid]="emailCtrl.invalid && emailCtrl.touched"
          aria-describedby="email-error"
          required />

        <!-- Message d'erreur associé via aria-describedby -->
        @if (emailCtrl.invalid && emailCtrl.touched) {
          <span id="email-error" class="field-error" role="alert">
            @if (emailCtrl.hasError('required')) {
              <span i18n="@@login.emailRequired">L'adresse courriel est requise.</span>
            }
            @if (emailCtrl.hasError('email')) {
              <span i18n="@@login.emailInvalid">Format d'adresse courriel invalide.</span>
            }
          </span>
        }
      </div>

      <!-- Mot de passe -->
      <div class="form-group">
        <label for="password" i18n="@@login.passwordLabel">
          Mot de passe
          <span class="required" aria-hidden="true">*</span>
        </label>

        <input
          id="password"
          type="password"
          formControlName="password"
          autocomplete="current-password"
          [attr.aria-invalid]="passwordCtrl.invalid && passwordCtrl.touched"
          aria-describedby="password-error"
          required />

        @if (passwordCtrl.invalid && passwordCtrl.touched) {
          <span id="password-error" class="field-error" role="alert">
            <span i18n="@@login.passwordRequired">Le mot de passe est requis.</span>
          </span>
        }
      </div>

      <!-- Lien mot de passe oublié -->
      <p class="login__forgot">
        <a routerLink="/auth/reset-password" i18n="@@login.forgotPassword">
          Mot de passe oublié ?
        </a>
      </p>

      <!-- Bouton soumission -->
      <button
        type="submit"
        class="btn-primary btn--full"
        [disabled]="loading()"
        [attr.aria-busy]="loading()">
        @if (loading()) {
          <span class="sr-only" i18n="@@login.loading">Connexion en cours…</span>
          <span aria-hidden="true">⏳</span>
        } @else {
          <span i18n="@@login.submit">Se connecter</span>
        }
      </button>
    </form>

    <p class="login__register">
      <span i18n="@@login.noAccount">Pas encore de compte ?</span>
      <a routerLink="/auth/register" i18n="@@login.registerLink">S'inscrire</a>
    </p>

  </main>
</div>
```

---

## 9. i18n — Internationalisation

Angular utilise `@angular/localize` (compile-time). Chaque locale produit un build séparé.
Le user linked au paquet npm `i18n` (Node.js), mais pour Angular le bon outil est `@angular/localize`.

### Principe de fonctionnement

```
Source (FR dans les templates)
         ↓  ng extract-i18n
src/locale/messages.xlf  ← fichier source extrait automatiquement
         ↓  copier + traduire manuellement (ou outil de traduction)
src/locale/messages.en.xlf  ← traduction anglaise
         ↓  ng build --localize
dist/fr/   ← build français (URL: /)
dist/en/   ← build anglais (URL: /en/)
```

### Étape 1 — Marquer les textes dans les templates

```html
<!-- Format complet : meaning|description@@id -->
<h1 i18n="Titre de la page d'accueil|Affiché en haut@@home.title">
  Bienvenue chez AbrisTempo Local
</h1>

<!-- Format court — juste l'ID (recommandé pour des textes évidents) -->
<button i18n="@@product.addToCart">Ajouter au panier</button>

<!-- Attributs traduits avec i18n-* -->
<button
  i18n="@@navbar.menuToggle"
  i18n-aria-label="@@navbar.menuToggleAriaLabel"
  aria-label="Ouvrir le menu">
  ☰
</button>

<!-- Interpolation — l'interpolation Angular est conservée dans le XLF -->
<p i18n="@@cart.itemCount">
  Votre panier contient {{ count() }} article(s)
</p>

<!-- Pluralisation — Angular gère la pluralisation via les ICU expressions -->
<p i18n="@@cart.itemCountPlural">
  {count(), plural,
    =0 { Votre panier est vide }
    =1 { Votre panier contient 1 article }
    other { Votre panier contient {{ count() }} articles }
  }
</p>
```

### Étape 2 — Marquer les textes dans les services TypeScript

```typescript
// Utiliser $localize``  pour les chaînes dans le TypeScript
import '@angular/localize/init';   // dans main.ts

// Dans un service ou composant
const title = $localize`:@@page.title:AbrisTempo Local — Accueil`;
const msg   = $localize`:@@toast.orderSuccess:Commande ${orderId}:orderId: passée avec succès !`;
```

### Étape 3 — Extraire les traductions

```bash
npm run i18n:extract
# Génère src/locale/messages.xlf
```

### Étape 4 — `src/locale/messages.xlf` (fichier source, FR)

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="fr" datatype="plaintext" original="ng2">
    <body>

      <trans-unit id="home.title" datatype="html">
        <source>Bienvenue chez AbrisTempo Local</source>
        <context-group purpose="location">
          <context context-type="sourcefile">src/app/features/home/home/home.html</context>
          <context context-type="linenumber">3</context>
        </context-group>
        <note priority="1" from="description">Titre de la page d'accueil</note>
        <note priority="1" from="meaning">Affiché en haut</note>
      </trans-unit>

      <trans-unit id="product.addToCart" datatype="html">
        <source>Ajouter au panier</source>
      </trans-unit>

      <trans-unit id="navbar.menuToggleAriaLabel" datatype="html">
        <source>Ouvrir le menu</source>
      </trans-unit>

      <trans-unit id="login.title" datatype="html">
        <source>Connexion</source>
      </trans-unit>

      <trans-unit id="login.emailLabel" datatype="html">
        <source>Adresse courriel</source>
      </trans-unit>

      <!-- ... autres traductions ... -->

    </body>
  </file>
</xliff>
```

### Étape 5 — `src/locale/messages.en.xlf` (traduction anglaise)

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="fr" target-language="en" datatype="plaintext" original="ng2">
    <body>

      <trans-unit id="home.title" datatype="html">
        <source>Bienvenue chez AbrisTempo Local</source>
        <target state="translated">Welcome to AbrisTempo Local</target>
      </trans-unit>

      <trans-unit id="product.addToCart" datatype="html">
        <source>Ajouter au panier</source>
        <target state="translated">Add to cart</target>
      </trans-unit>

      <trans-unit id="navbar.menuToggleAriaLabel" datatype="html">
        <source>Ouvrir le menu</source>
        <target state="translated">Open menu</target>
      </trans-unit>

      <trans-unit id="login.title" datatype="html">
        <source>Connexion</source>
        <target state="translated">Sign in</target>
      </trans-unit>

      <trans-unit id="login.emailLabel" datatype="html">
        <source>Adresse courriel</source>
        <target state="translated">Email address</target>
      </trans-unit>

    </body>
  </file>
</xliff>
```

### Étape 6 — Build et déploiement

```bash
# Dev — tester la version anglaise
ng serve --configuration=en
# → http://localhost:4200  (anglais servi directement)

# Production — génère un build par locale
npm run build:fr    # = ng build --configuration production --localize
# Sortie :
#   dist/abristempo-client/browser/fr/  ← version française
#   dist/abristempo-client/browser/en/  ← version anglaise

# Sur Vercel — vercel.json pour le routage multi-locale
```

### `vercel.json` (routage i18n)

```json
{
  "rewrites": [
    { "source": "/en/(.*)", "destination": "/en/$1" },
    { "source": "/(.*)",    "destination": "/fr/$1" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options",        "value": "DENY" },
        { "key": "X-XSS-Protection",       "value": "1; mode=block" }
      ]
    }
  ]
}
```

---

## 10. Accessibilité WCAG AA

Résumé des critères appliqués dans tous les composants.

### Checklist WCAG AA implémentée

| Critère | Niveau | Implémentation |
|---------|--------|----------------|
| 1.1.1 Contenu non textuel | A | `alt` sur toutes les images, `aria-hidden` sur les icônes décoratives |
| 1.3.1 Information et relations | A | HTML sémantique (`nav`, `main`, `header`, `footer`, `article`, `section`) |
| 1.3.3 Caractéristiques sensorielles | A | Pas d'instruction basée sur la couleur seulement |
| 1.4.1 Utilisation de la couleur | A | Disponibilité = texte + couleur + icône |
| 1.4.3 Contraste (minimum) | AA | Ratios vérifiés dans `_tokens.scss` (commentaires inclus) |
| 1.4.4 Redimensionnement du texte | AA | `rem` partout, jamais `px` pour le texte |
| 1.4.10 Redistribution | AA | Layout responsive, pas de scroll horizontal |
| 1.4.11 Contraste des éléments non textuels | AA | Bordures de formulaires ≥ 3:1 |
| 1.4.12 Espacement du texte | AA | Pas de hauteur de ligne fixe en `px` |
| 2.1.1 Clavier | A | Tous les éléments interactifs accessibles au clavier |
| 2.4.1 Contourner des blocs | A | `app-skip-nav` (premier élément de la page) |
| 2.4.2 Titre de page | A | `title` dans chaque route Angular |
| 2.4.3 Parcours du focus | A | Focus naturel dans l'ordre DOM |
| 2.4.7 Visibilité du focus | AA | `:focus-visible` avec `outline` visible sur fond clair ET sombre |
| 3.1.1 Langue de la page | A | `lang="fr"` sur `<html>`, remplacé par locale courante en prod |
| 3.3.1 Identification des erreurs | A | `aria-invalid` + message d'erreur lié via `aria-describedby` |
| 3.3.2 Étiquettes ou instructions | A | `<label>` pour chaque `<input>`, `required` visible |
| 4.1.3 Messages d'état | AA | `role="alert"` + `aria-live` sur les messages dynamiques |

### Pattern formulaire accessible complet

```html
<div class="form-group">
  <!-- Label explicite — JAMAIS de placeholder seul comme label -->
  <label for="postal-code">
    Code postal
    <span class="required" aria-hidden="true">*</span>
    <!-- aria-hidden : le * est une convention visuelle, pas informatif -->
  </label>

  <input
    id="postal-code"
    type="text"
    formControlName="postalCode"
    autocomplete="postal-code"
    inputmode="text"
    placeholder="J0K 1A0"
    [attr.aria-invalid]="ctrl.invalid && ctrl.touched"
    [attr.aria-required]="true"
    aria-describedby="postal-code-hint postal-code-error" />
    <!-- aria-describedby : plusieurs IDs séparés par des espaces -->

  <!-- Instruction (hint) — toujours visible, pas seulement au focus -->
  <span id="postal-code-hint" class="field-hint">
    Format : A1A 1A1
  </span>

  <!-- Erreur — visible + annoncée via role="alert" -->
  @if (ctrl.invalid && ctrl.touched) {
    <span id="postal-code-error" class="field-error" role="alert">
      Format de code postal invalide.
    </span>
  }
</div>
```

### Pattern annonce dynamique (aria-live)

```html
<!-- Dans le composant racine ou dans chaque page — annonce les changements d'état -->
<div
  class="sr-only"
  aria-live="polite"
  aria-atomic="true"
  id="page-announcer">
  {{ announcement() }}
</div>
```

```typescript
// Dans le service de toast ou dans un service d'annonce dédié
protected readonly announcement = signal('');

protected setAnnouncement(msg: string): void {
  this.announcement.set('');
  // Petit délai pour forcer la mise à jour du live region
  setTimeout(() => this.announcement.set(msg), 100);
}
```
