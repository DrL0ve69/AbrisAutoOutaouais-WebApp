import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { GuestContactRequest } from '../models/guest-contact.model';

/**
 * Règles de validation du contact invité côté client — alignées sur le validateur serveur
 * `GuestContactValidator` (leçon L-004 : un format partagé est validé pareil partout). Source UNIQUE
 * réutilisée par la caisse, la location et l'installation : chaque écran construit son groupe via
 * `buildGuestContactGroup(fb)` plutôt que de redéclarer les contrôles (évite la dérive entre écrans).
 */

/**
 * Téléphone facultatif : 10 à 20 caractères composés de chiffres, espaces et séparateurs usuels
 * (`+`, `-`, `.`, parenthèses). Miroir exact du backend `^[\d\s().+-]{10,20}$`.
 */
export const GUEST_PHONE_PATTERN = /^[\d\s().+-]{10,20}$/;

/** Type du `FormGroup` exposé par `buildGuestContactGroup`, partagé par les écrans et le composant. */
export type GuestContactForm = FormGroup<{
  firstName: FormControl<string>;
  lastName: FormControl<string>;
  email: FormControl<string>;
  phone: FormControl<string>;
}>;

/**
 * Construit le `FormGroup` du contact invité (prénom, nom, courriel requis ; téléphone optionnel).
 * `Validators.email` côté client double l'`EmailAddress()` serveur ; le téléphone n'est validé que
 * s'il est renseigné (le `pattern` ignore la chaîne vide).
 */
export function buildGuestContactGroup(fb: FormBuilder): GuestContactForm {
  return fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(256)]],
    phone: ['', Validators.pattern(GUEST_PHONE_PATTERN)],
  });
}

/**
 * Construit la charge `GuestContactRequest` (camelCase) à partir du groupe — téléphone vide ⇒ `null`.
 * Source UNIQUE de l'assemblage, partagée par les trois écrans (pas de duplication — L-018).
 */
export function toGuestContactRequest(group: GuestContactForm): GuestContactRequest {
  const v = group.getRawValue();
  return {
    firstName: v.firstName.trim(),
    lastName: v.lastName.trim(),
    email: v.email.trim(),
    phone: v.phone.trim() || null,
  };
}
