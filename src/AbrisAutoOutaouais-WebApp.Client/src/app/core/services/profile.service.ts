import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormGroup } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { AddressDto } from '../models/booking.model';
import { UserProfileDto } from '../models/profile.model';

/**
 * Source unique de l'adresse de livraison par défaut côté client.
 *
 * Le cache d'authentification (`AuthService`) ne transporte PAS l'adresse — celle-ci ne vit
 * que dans `GET /auth/me` (voir leçon L-003). Ce service charge le profil une seule fois et
 * l'expose en signal, pour que la caisse, la location et l'installation puissent pré-remplir
 * leur formulaire d'adresse automatiquement.
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private readonly _profile = signal<UserProfileDto | null>(null);
  private loaded = false;
  private inFlight = false;

  readonly profile = this._profile.asReadonly();
  readonly defaultDeliveryAddress = computed(
    () => this._profile()?.defaultDeliveryAddress ?? null,
  );

  constructor() {
    // Vide le cache à la déconnexion : ne jamais fuiter l'adresse d'un compte vers un autre.
    effect(() => {
      if (!this.auth.isAuthenticated()) {
        this._profile.set(null);
        this.loaded = false;
      }
    });
  }

  /** Charge GET /auth/me une seule fois par session. No-op si déjà chargé ou non connecté. */
  ensureLoaded(): void {
    if (this.loaded || this.inFlight || !this.auth.isAuthenticated()) return;
    this.inFlight = true;
    this.http.get<UserProfileDto>(`${environment.apiUrl}/auth/me`).subscribe({
      next: (profile) => {
        this._profile.set(profile);
        this.loaded = true;
        this.inFlight = false;
      },
      error: () => {
        this.inFlight = false;
      },
    });
  }

  /** Met à jour le profil en cache après une sauvegarde réussie (garde l'adresse fraîche). */
  setProfile(profile: UserProfileDto): void {
    this._profile.set(profile);
    this.loaded = true;
  }

  /**
   * Pré-remplit les champs d'adresse d'un formulaire réactif avec l'adresse par défaut —
   * tant que l'utilisateur n'a PAS touché le champ (pristine). On remplit même un champ qui
   * porte une valeur par défaut (« QC », « Canada ») : un défaut n'est pas une saisie. Dès que
   * l'utilisateur édite un champ (dirty), on ne l'écrase jamais (voir leçon L-002). À appeler
   * dans un `effect()` du composant.
   */
  applyDefaultAddress(
    form: FormGroup,
    address: AddressDto | null = this.defaultDeliveryAddress(),
  ): void {
    if (!address) return;
    const values: Record<string, string> = {
      civicNumber: address.civicNumber,
      street: address.street,
      apartment: address.apartment ?? '',
      city: address.city,
      province: address.province,
      postalCode: address.postalCode,
      country: address.country,
    };
    for (const [name, value] of Object.entries(values)) {
      const control = form.get(name);
      if (control && control.pristine) {
        control.setValue(value);
      }
    }
  }
}
