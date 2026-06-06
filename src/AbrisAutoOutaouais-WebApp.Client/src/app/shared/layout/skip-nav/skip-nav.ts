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
