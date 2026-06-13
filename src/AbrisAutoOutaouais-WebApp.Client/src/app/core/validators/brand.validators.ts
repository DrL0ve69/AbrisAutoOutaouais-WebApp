import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Marques d'abris exclues du service d'installation. Reflet côté client de la source canonique
 * unique `Domain/Constants/ExcludedShelterBrands.cs` (leçon L-004 : une seule définition,
 * partagée client/serveur). Le serveur reste l'autorité (validateur 422 + invariant agrégat) ;
 * ce validateur n'apporte que l'UX. Garder les deux listes en phase.
 */
export const EXCLUDED_BRANDS = ['ShelterLogic'] as const;

/**
 * Refuse une marque exclue (comparaison insensible à la casse, après trim).
 * Une valeur vide est valide (champ optionnel) → erreur `{ excludedBrand: true }` sinon.
 */
export const excludedBrandValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const value = (control.value ?? '').trim().toLowerCase();
  if (!value) return null;
  const excluded = EXCLUDED_BRANDS.some(b => b.toLowerCase() === value);
  return excluded ? { excludedBrand: true } : null;
};
