import { Injectable, inject } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Observable, EMPTY, catchError, filter, map } from 'rxjs';
import { PlacesService } from './places.service';
import { PlaceSuggestionDto } from '../models/place.model';
import { normalizePostal } from '../validators/address.validators';

/**
 * Logique d'autocomplétion d'adresse partagée par la caisse, la location, l'installation
 * et le profil — extraite des 4 formulaires (Epic C, dé-duplication PR #16) pour qu'elle ne
 * vive qu'à un seul endroit.
 *
 * Sémantique préservée à l'identique :
 *  - Le choix d'une suggestion patche civic/rue/ville/province INCONDITIONNELLEMENT (action
 *    utilisateur explicite, donc HORS garde pristine de L-002 — distinct de
 *    `ProfileService.applyDefaultAddress` qui, lui, reste pristine).
 *  - On marque « rue » dirty, puis on résout le code postal et on le patche normalisé
 *    (« A1A 1A1 », L-004) ; le champ code postal RESTE éditable. Si le proxy renvoie `null`
 *    ou échoue, on ne patche AUCUN code postal (erreur silencieuse : saisie manuelle possible).
 *  - Le formulaire est typé de façon lâche (`FormGroup`) : les 4 formulaires divergent
 *    légèrement (présence/validateurs des contrôles), mais partagent les noms d'adresse.
 *    `patchValue` re-déclenche d'éventuels validateurs de groupe (ex. checkout
 *    `addressRequiredIfDelivery`).
 */
@Injectable({ providedIn: 'root' })
export class AddressAutofillService {
  private readonly places = inject(PlacesService);

  /**
   * Applique une suggestion d'adresse au formulaire et déclenche la résolution du code postal.
   *
   * Patche civic/rue/ville/province immédiatement (synchronement), marque « rue » dirty, puis
   * retourne un `Observable<string>` qui émet UNE fois le code postal normalisé déjà patché dans
   * le contrôle `postalCode` — le composant s'y abonne (avec `takeUntilDestroyed`) pour lever son
   * signal `postalAutofilled` (aria-live). N'émet jamais si le code postal est absent/erroné.
   */
  applySuggestion(form: FormGroup, s: PlaceSuggestionDto): Observable<string> {
    form.patchValue({
      civicNumber: s.civicNumber ?? '',
      street: s.street,
      city: s.city,
      province: s.province || 'QC',
    });
    form.get('street')?.markAsDirty();

    return this.places.lookupPostalCode(s.civicNumber ?? '', s.street, s.city, s.province).pipe(
      map(({ postalCode }) => postalCode),
      filter((postalCode): postalCode is string => !!postalCode),
      map(normalizePostal),
      map(normalized => {
        form.get('postalCode')?.setValue(normalized);
        return normalized;
      }),
      // Silencieux : l'utilisateur peut saisir le code postal manuellement.
      catchError(() => EMPTY),
    );
  }

  /** Frappe libre dans le combobox : synchronise le contrôle « rue » (setValue + dirty). */
  syncStreet(form: FormGroup, value: string): void {
    const street = form.get('street');
    street?.setValue(value);
    street?.markAsDirty();
  }
}
