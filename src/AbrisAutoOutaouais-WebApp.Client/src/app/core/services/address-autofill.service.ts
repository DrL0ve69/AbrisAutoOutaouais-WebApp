import { Injectable, inject } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Observable, of, catchError, map } from 'rxjs';
import { PlacesService } from './places.service';
import { PlaceSuggestionDto } from '../models/place.model';
import { normalizePostal, parseCivicFromLabel } from '../validators/address.validators';

/**
 * Résultat de la résolution du code postal après le choix d'une suggestion :
 *  - `filled`      : un code postal a été résolu, normalisé (« A1A 1A1 », L-004) et patché dans
 *                    le contrôle `postalCode` — le composant annonce le remplissage auto.
 *  - `unavailable` : le proxy n'a renvoyé aucun code postal (ou a échoué) → le contrôle reste
 *                    vide et éditable ; le composant invite à la saisie manuelle.
 */
export type PostalFillResult =
  | { readonly status: 'filled'; readonly postalCode: string }
  | { readonly status: 'unavailable' };

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
   * retourne un `Observable<PostalFillResult>` qui émet UNE fois l'issue de la résolution du code
   * postal — le composant s'y abonne (avec `takeUntilDestroyed`) pour annoncer soit le remplissage
   * auto (`filled`), soit l'indisponibilité (`unavailable`, saisie manuelle).
   *
   * D1 — cascade civique : le numéro saisi par l'utilisateur n'est JAMAIS écrasé par une chaîne
   * vide. Photon renvoie souvent `civicNumber: null` tout en incluant le numéro dans `label` ; on
   * tente donc, dans l'ordre : la valeur de la suggestion, le numéro parsé du libellé, puis la
   * valeur déjà saisie dans le formulaire.
   *
   * D3 — la normalisation province (code 2 lettres canonique) vit côté serveur dans
   * `CanadianProvinceCodes` (L-004/L-011) : chaque adaptateur `IPlacesService` émet déjà le format
   * canonique. Le patch civic/ville/province est donc INCONDITIONNEL ici (action utilisateur
   * explicite, hors garde pristine de L-002 qui appartient à `ProfileService.applyDefaultAddress`),
   * SANS whitelist côté client (la réintroduire régresserait Ontario → 400, L-004 §C1).
   */
  applySuggestion(form: FormGroup, s: PlaceSuggestionDto): Observable<PostalFillResult> {
    const civic =
      s.civicNumber?.trim() || parseCivicFromLabel(s.label) || (form.get('civicNumber')?.value ?? '');
    form.patchValue({
      civicNumber: civic,
      street: s.street,
      city: s.city,
      province: s.province || 'QC',
    });
    form.get('street')?.markAsDirty();

    // D2 — Photon fournit souvent `postcode` dans `suggest` mais pas dans le lookup limit=1 :
    // si la suggestion porte déjà un code postal, on le normalise sans appel réseau.
    if (s.postalCode && s.postalCode.trim()) {
      const normalized = normalizePostal(s.postalCode);
      form.get('postalCode')?.setValue(normalized);
      return of<PostalFillResult>({ status: 'filled', postalCode: normalized });
    }

    return this.places.lookupPostalCode(civic, s.street, s.city, s.province).pipe(
      map(({ postalCode }): PostalFillResult => {
        if (!postalCode) {
          return { status: 'unavailable' };
        }
        const normalized = normalizePostal(postalCode);
        form.get('postalCode')?.setValue(normalized);
        return { status: 'filled', postalCode: normalized };
      }),
      // Échec réseau → indisponible (l'utilisateur peut saisir le code postal manuellement).
      catchError(() => of<PostalFillResult>({ status: 'unavailable' })),
    );
  }

  /** Frappe libre dans le combobox : synchronise le contrôle « rue » (setValue + dirty). */
  syncStreet(form: FormGroup, value: string): void {
    const street = form.get('street');
    street?.setValue(value);
    street?.markAsDirty();
  }
}
