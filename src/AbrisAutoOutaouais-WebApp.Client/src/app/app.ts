import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/layout/navbar/navbar';
import { FooterComponent } from './shared/layout/footer/footer';
import { SkipNavComponent } from './shared/layout/skip-nav/skip-nav';
import { LocaleService } from './core/services/locale.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, NavbarComponent, FooterComponent, SkipNavComponent],
})
export class AppComponent {
  // Exposé au template pour annoncer la confirmation de changement de langue (H1).
  protected readonly locale = inject(LocaleService);
}
