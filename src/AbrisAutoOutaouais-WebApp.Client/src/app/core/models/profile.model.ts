import { AddressDto } from './booking.model';

/** Profil complet renvoyé par GET /auth/me — correspond à UserProfileDto côté backend. */
export interface UserProfileDto {
  readonly id: string;
  readonly email: string;
  readonly username: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phoneNumber: string | null;
  readonly avatar: string | null;
  readonly preferredLanguage: string;
  readonly defaultDeliveryAddress: AddressDto | null;
  readonly createdAt: string;
  readonly roles: readonly string[];
}

/** Corps de PUT /auth/me — correspond à UpdateProfileRequest côté backend. */
export interface UpdateProfileRequest {
  readonly firstName: string;
  readonly lastName: string;
  readonly phoneNumber: string | null;
  readonly preferredLanguage: string;
  readonly defaultDeliveryAddress: AddressDto | null;
}
