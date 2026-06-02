import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router';
// import { LiveAnnouncer } from '@angular/cdk/a11y';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';
import { ThemeService } from './core/services/theme.service';
// import { MainNavComponent } from './shared/layout/main-nav/main-nav';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, /*MainNavComponent*/],
  changeDetection: ChangeDetectionStrategy.OnPush,
  /*host: { '[class.high-contrast]': 'themeService.isHighContrast()' },*/
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class AppComponent {
  private readonly router = inject(Router);
  // private readonly liveAnnouncer = inject(LiveAnnouncer);
  protected readonly themeService = inject(ThemeService);

  constructor() {
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.handleNavigationA11y();
      });
  }

  private handleNavigationA11y(): void {
    // Annonce le changement de page aux lecteurs d'écran
    // this.liveAnnouncer.announce(`Page chargée : ${document.title}`, 'polite');

    // Déplace le focus au contenu principal pour éviter de devoir retaper la nav
    const mainContent = document.getElementById('main-content');
    mainContent?.focus();
  }
}
