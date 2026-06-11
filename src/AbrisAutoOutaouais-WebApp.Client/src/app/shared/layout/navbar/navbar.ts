import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  PLATFORM_ID,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../core/services/cart.service';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  host: {
    class: 'navbar-host',
    // Écoute du scroll sans @HostListener (convention v21).
    '(window:scroll)': 'onScroll()',
  },
})
export class NavbarComponent {
  protected readonly auth = inject(AuthService);
  protected readonly cart = inject(CartService);
  protected readonly theme = inject(ThemeService);
  private readonly platform = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);

  protected readonly menuOpen = signal(false);
  protected readonly scrolled = signal(false);
  protected readonly userMenuOpen = signal(false);

  // Locale courante détectée à partir du baseHref (fr par défaut, /en/ → en).
  protected readonly currentLang = signal<'fr' | 'en'>(this.detectLang());

  protected readonly cartLabel = computed(() => {
    const n = this.cart.count();
    return n === 0
      ? 'Panier, vide'
      : n === 1
        ? 'Panier, 1 article'
        : `Panier, ${n} articles`;
  });

  protected readonly themeLabel = computed(() =>
    this.theme.theme() === 'dark'
      ? 'Activer le thème clair'
      : 'Activer le thème sombre',
  );

  // Détecter le scroll pour changer l'apparence de la navbar.
  protected onScroll(): void {
    if (!isPlatformBrowser(this.platform)) return;
    this.scrolled.set(this.document.defaultView!.scrollY > 20);
  }

  protected toggleMenu(): void {
    this.menuOpen.update(v => !v);
    if (this.menuOpen()) this.userMenuOpen.set(false);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected toggleUserMenu(): void {
    this.userMenuOpen.update(v => !v);
  }

  protected closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  protected toggleTheme(): void {
    this.theme.toggle();
  }

  /**
   * Change la langue. L'i18n est compile-time : changer de locale = naviguer
   * vers le baseHref de l'autre build (« / » pour fr, « /en/ » pour en).
   * Le build localisé est requis (`npm run build:fr` / configuration `en`) ;
   * en `ng serve` standard seul le français est servi.
   */
  protected switchLang(lang: 'fr' | 'en'): void {
    if (!isPlatformBrowser(this.platform) || lang === this.currentLang()) return;
    const target = lang === 'en' ? '/en/' : '/';
    this.document.defaultView!.location.href = target;
  }

  protected logout(): void {
    this.auth.logout();
    this.closeMenu();
    this.closeUserMenu();
  }

  private detectLang(): 'fr' | 'en' {
    if (!isPlatformBrowser(this.platform)) return 'fr';
    return this.document.defaultView!.location.pathname.startsWith('/en') ? 'en' : 'fr';
  }
}
