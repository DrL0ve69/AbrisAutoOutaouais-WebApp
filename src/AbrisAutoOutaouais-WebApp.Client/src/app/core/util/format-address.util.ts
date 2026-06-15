import { AddressDto } from '../models/booking.model';

/**
 * Met en forme une adresse sur une seule ligne lisible, pour l'affichage en lecture seule
 * (ex. la pastille « Adresse de mon profil » du composant `app-address-choice`).
 *
 * Forme : « 111 rue Wellington, app. 4B, Ottawa, ON K1A 0A6 ».
 *  - L'appartement n'apparaît que s'il est renseigné (préfixe « app. »).
 *  - Province et code postal sont collés par une espace (convention canadienne).
 *  - Fonction PURE : aucune dépendance Angular, aucun accès DOM — testable directement.
 */
export function formatAddressLine(a: AddressDto): string {
  const civicStreet = `${a.civicNumber} ${a.street}`.trim();
  const apartment = a.apartment?.trim() ? `app. ${a.apartment.trim()}` : '';
  const provincePostal = [a.province?.trim(), a.postalCode?.trim()]
    .filter((part) => !!part)
    .join(' ');

  return [civicStreet, apartment, a.city?.trim(), provincePostal]
    .filter((part) => !!part)
    .join(', ');
}
