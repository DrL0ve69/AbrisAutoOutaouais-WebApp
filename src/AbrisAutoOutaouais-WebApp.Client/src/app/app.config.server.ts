import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
// import { provideServerRoutesConfig } from '@angular/ssr';
import { appConfig } from './app.config';
import { routes } from './app.routes';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(),
    // provideServerRoutesConfig(routes),
  ],
};

export const appServerConfig = mergeApplicationConfig(appConfig, serverConfig);
