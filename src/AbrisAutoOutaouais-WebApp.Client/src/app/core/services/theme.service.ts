import { Injectable, effect, inject, computed } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly authService = inject(AuthService);
  // readonly isHighContrast = () => this.authService.authUser()?.highContrastEnabled || false;
  readonly isLoggedIn = computed(() => this.authService.isAuthenticated());

  // constructor() {
  //   // Un "effect" s'exécute automatiquement dès que le signal profile() change
  //   effect(() => {
  //     const profile = this.authService.authUser();
  //     if (profile?.highContrastEnabled) {
  //       document.body.classList.add('high-contrast');
  //     } else {
  //       document.body.classList.remove('high-contrast');
  //     }
  //   });
  // }
}
