import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  signal,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../core/services/cart.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  host: {
    class: 'navbar-host',
  },
})
export class NavbarComponent {
  protected readonly auth = inject(AuthService);
  protected readonly cart = inject(CartService);
  private readonly platform = inject(PLATFORM_ID);

  protected readonly menuOpen = signal(false);
  protected readonly scrolled = signal(false);
  protected readonly userMenuOpen = signal(false);

  protected readonly cartLabel = computed(() => {
    const n = this.cart.count();
    return n === 0
      ? 'Panier, vide'
      : n === 1
        ? 'Panier, 1 article'
        : `Panier, ${n} articles`;
  });

  // Détecter le scroll pour changer l'apparence de la navbar
  @HostListener('window:scroll', [])
  onScroll(): void {
    if (!isPlatformBrowser(this.platform)) return;
    this.scrolled.set(window.scrollY > 20);
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

  protected logout(): void {
    this.auth.logout();
    this.closeMenu();
    this.closeUserMenu();
  }
}
