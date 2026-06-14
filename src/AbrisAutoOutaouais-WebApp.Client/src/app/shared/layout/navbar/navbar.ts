import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
  PLATFORM_ID,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../core/services/cart.service';
import { ThemeService } from '../../../core/services/theme.service';
import { LocaleService } from '../../../core/services/locale.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  host: {
    class: 'navbar-host',
    // Écoute sans @HostListener (convention v21).
    '(window:scroll)': 'onScroll()',
    // Fermeture des menus au clavier (Échap) et au clic extérieur — pattern
    // disclosure (WCAG 2.1.2 / H3 « Contrôle et liberté »).
    '(document:keydown.escape)': 'onEscape()',
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class NavbarComponent {
  protected readonly auth = inject(AuthService);
  protected readonly cart = inject(CartService);
  protected readonly theme = inject(ThemeService);
  protected readonly locale = inject(LocaleService);
  private readonly platform = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);

  // Références pour le renvoi de focus à la fermeture des menus.
  private readonly userMenuWrap = viewChild<ElementRef<HTMLElement>>('userMenuWrap');
  private readonly userMenuBtn = viewChild<ElementRef<HTMLElement>>('userMenuBtn');
  private readonly mobileMenu = viewChild<ElementRef<HTMLElement>>('mobileMenu');
  private readonly hamburger = viewChild<ElementRef<HTMLElement>>('hamburger');

  protected readonly menuOpen = signal(false);
  protected readonly scrolled = signal(false);
  protected readonly userMenuOpen = signal(false);

  /**
   * Infobulle (souris) du bouton de langue quand il est dégradé en build
   * mono-locale. Même texte que l'explication `sr-only` (@@navbar.langUnavailable),
   * localisé via $localize — `title` ne peut pas porter d'`i18n-` dans le template
   * quand il est lié dynamiquement, donc la traduction est résolue ici.
   */
  protected readonly langUnavailableTitle = $localize`:@@navbar.langUnavailable:Disponible uniquement dans la version localisée (build bilingue).`;

  protected readonly cartLabel = computed(() => {
    const n = this.cart.count();
    return n === 0 ? 'Panier, vide' : n === 1 ? 'Panier, 1 article' : `Panier, ${n} articles`;
  });

  protected readonly themeLabel = computed(() =>
    this.theme.theme() === 'dark' ? 'Activer le thème clair' : 'Activer le thème sombre',
  );

  // Détecter le scroll pour changer l'apparence de la navbar.
  protected onScroll(): void {
    if (!isPlatformBrowser(this.platform)) return;
    this.scrolled.set(this.document.defaultView!.scrollY > 20);
  }

  protected toggleMenu(): void {
    this.menuOpen.update((v) => !v);
    if (this.menuOpen()) this.userMenuOpen.set(false);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected toggleUserMenu(): void {
    this.userMenuOpen.update((v) => !v);
  }

  protected closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  /** Échap ferme le menu ouvert et renvoie le focus à son déclencheur. */
  protected onEscape(): void {
    if (this.userMenuOpen()) {
      this.userMenuOpen.set(false);
      this.userMenuBtn()?.nativeElement.focus();
    }
    if (this.menuOpen()) {
      this.menuOpen.set(false);
      this.hamburger()?.nativeElement.focus();
    }
  }

  /** Un clic hors d'un menu ouvert le referme (sans déplacer le focus). */
  protected onDocumentClick(event: MouseEvent): void {
    if (!isPlatformBrowser(this.platform)) return;
    const target = event.target as Node;

    if (this.userMenuOpen() && !this.userMenuWrap()?.nativeElement.contains(target)) {
      this.userMenuOpen.set(false);
    }

    if (
      this.menuOpen() &&
      !this.mobileMenu()?.nativeElement.contains(target) &&
      !this.hamburger()?.nativeElement.contains(target)
    ) {
      this.menuOpen.set(false);
    }
  }

  protected toggleTheme(): void {
    this.theme.toggle();
  }

  protected logout(): void {
    this.auth.logout();
    this.closeMenu();
    this.closeUserMenu();
  }
}
