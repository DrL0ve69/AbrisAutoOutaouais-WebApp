/// <reference types="@angular/localize" />

import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app';
import { appServerConfig } from './app/app.config.server';

const bootstrap = () => bootstrapApplication(AppComponent, appServerConfig);
export default bootstrap;
