import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminUserDto } from '../models/user.model';

/**
 * Consultation des comptes utilisateurs (lecture seule).
 * Réservé aux administrateurs — le JWT est attaché par l'intercepteur HTTP existant
 * et l'API exige la politique « AdminOnly ».
 * Singleton applicatif — providedIn: 'root'.
 */
@Injectable({ providedIn: 'root' })
export class AdminUserService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /** Tous les utilisateurs, du plus récent au plus ancien. */
  getAllUsers(): Observable<AdminUserDto[]> {
    return this.http.get<AdminUserDto[]>(`${this.baseUrl}/users`);
  }
}
