/** Utilisateur tel que vu par l'administration (GET /users) — correspond à AdminUserDto C#. */
export interface AdminUserDto {
  readonly id: string;
  readonly email: string;
  readonly username: string;
  readonly fullName: string;
  readonly roles: readonly string[];
  readonly createdAt: string;
  readonly isLockedOut: boolean;
}
