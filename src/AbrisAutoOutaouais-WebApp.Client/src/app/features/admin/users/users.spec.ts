import { render, screen } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { registerLocaleData } from '@angular/common';
import localeFrCa from '@angular/common/locales/fr-CA';
import { AdminUsersComponent } from './users';
import { AdminUserService } from '../../../core/services/admin-user.service';
import { ToastService } from '../../../core/services/toast.service';
import { AdminUserDto } from '../../../core/models/user.model';
import { expectNoA11yViolations } from '../../../../testing/axe-helper';

// La page affiche des dates (DatePipe) en 'fr-CA'.
registerLocaleData(localeFrCa);

const adminUser: AdminUserDto = {
  id: 'u1',
  email: 'admin@abrisauto.com',
  username: 'admin',
  fullName: 'Alice Admin',
  roles: ['Admin'],
  createdAt: '2026-01-15T10:00:00Z',
  isLockedOut: false,
};

const lockedCustomer: AdminUserDto = {
  id: 'u2',
  email: 'camille@test.com',
  username: 'camille',
  fullName: 'Camille Client',
  roles: ['Customer'],
  createdAt: '2026-03-20T10:00:00Z',
  isLockedOut: true,
};

async function setup(users: AdminUserDto[] = [adminUser, lockedCustomer]) {
  const adminStub: Partial<AdminUserService> = {
    getAllUsers: () => of(users),
  };
  const toastStub: Partial<ToastService> = { show: vi.fn() };

  return render(AdminUsersComponent, {
    providers: [
      provideRouter([]),
      { provide: AdminUserService, useValue: adminStub },
      { provide: ToastService, useValue: toastStub },
    ],
  });
}

describe('AdminUsersComponent', () => {
  it('affiche les comptes avec rôles traduits et état de verrouillage', async () => {
    await setup();

    expect(await screen.findByText('Alice Admin')).toBeInTheDocument();
    expect(screen.getByText('admin@abrisauto.com')).toBeInTheDocument();
    expect(screen.getByText('Administrateur')).toBeInTheDocument();
    expect(screen.getByText('Client')).toBeInTheDocument();
    // États : compte actif vs compte verrouillé.
    expect(screen.getByText('Actif')).toBeInTheDocument();
    expect(screen.getByText('Verrouillé')).toBeInTheDocument();
    // Lecture seule : aucune action dans la table.
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('affiche l’état vide quand il n’y a aucun utilisateur', async () => {
    await setup([]);

    expect(await screen.findByText(/aucun utilisateur/i)).toBeInTheDocument();
  });

  it('ne présente aucune violation WCAG', async () => {
    const { container } = await setup();

    await screen.findByText('Alice Admin');
    await expectNoA11yViolations(container);
  });
});
