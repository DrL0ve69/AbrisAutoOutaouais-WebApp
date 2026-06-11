import { ApplicationConfig, provideZoneChangeDetection, LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeFrCa from '@angular/common/locales/fr-CA';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';

// Enregistre les données de locale fr-CA — requises par les pipes utilisant 'fr-CA'
// (CurrencyPipe), sinon NG0701 « Missing locale data » au rendu des prix.
registerLocaleData(localeFrCa);
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
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
    provideAnimations(),
    // LOCALE_ID est injecté automatiquement par Angular lors du build --localize
    // Pas besoin de le déclarer manuellement
  ],
};
