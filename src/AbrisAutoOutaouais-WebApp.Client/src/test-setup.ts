// src/test-setup.ts
import '@angular/localize/init'; // définit $localize pour les composants i18n en test
import '@testing-library/jest-dom';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

try {
  getTestBed().initTestEnvironment(
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting(),
  );
} catch {
  // Environnement de test déjà initialisé (multi-fichiers / rechargement Vite) — ignorer.
}
