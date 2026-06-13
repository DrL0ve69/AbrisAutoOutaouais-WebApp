import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminUserService } from '../../../core/services/admin-user.service';
import { ToastService } from '../../../core/services/toast.service';
import { AdminUserDto } from '../../../core/models/user.model';

/**
 * Administration des utilisateurs — liste en lecture seule.
 * Accès protégé par authGuard + adminGuard (cf. app.routes.ts → /admin).
 * WCAG AA : table sémantique (caption, scope), badges décoratifs,
 * états de chargement annoncés via <output>.
 */
@Component({
  selector: 'app-admin-users',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe],
  templateUrl: './users.html',
  styleUrl: '../admin-shared.scss',
})
export class AdminUsersComponent {
  private readonly admin = inject(AdminUserService);
  private readonly toast = inject(ToastService);

  protected readonly items = signal<readonly AdminUserDto[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);

  constructor() {
    this.loadUsers();
  }

  protected loadUsers(): void {
    this.loading.set(true);
    this.error.set(false);
    this.admin.getAllUsers().subscribe({
      next: users => {
        this.items.set(users);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
        this.toast.show(
          $localize`:@@admin.users.toast.loadError:Échec du chargement des utilisateurs.`,
          'error',
        );
      },
    });
  }

  /** Libellé français d'un rôle (chaîne API : Customer / Staff / Admin). */
  protected roleLabel(role: string): string {
    switch (role) {
      case 'Admin':
        return $localize`:@@admin.users.role.admin:Administrateur`;
      case 'Staff':
        return $localize`:@@admin.users.role.staff:Personnel`;
      case 'Customer':
        return $localize`:@@admin.users.role.customer:Client`;
      default:
        return role;
    }
  }

  /** Suffixe de classe BEM pour la couleur du badge selon le rôle. */
  protected roleModifier(role: string): string {
    switch (role) {
      case 'Admin':
        return 'pending'; // ambre — met en évidence les comptes à privilèges
      case 'Staff':
        return 'confirmed'; // bleu
      default:
        return 'expired'; // gris neutre
    }
  }
}
