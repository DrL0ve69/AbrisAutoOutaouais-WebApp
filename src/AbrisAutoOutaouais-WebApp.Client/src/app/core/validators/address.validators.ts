/**
 * Source unique des règles de validation d'adresse côté client — alignée sur le validateur
 * serveur `AddressDtoValidator` (leçon L-004 : un format partagé doit être validé pareil
 * partout). Réutilisée par la caisse, la location, l'installation et le profil.
 */

/** Numéro civique : chiffres, lettre finale optionnelle (« 123 », « 123A »). */
export const CIVIC_PATTERN = /^\d+[A-Za-z]?$/;

/** Code postal canadien, avec ou sans espace, majuscules ou minuscules (« J8X 1A1 »). */
export const POSTAL_PATTERN = /^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/;

/** Provinces et territoires canadiens (pour les listes déroulantes). */
export const PROVINCES: readonly { readonly code: string; readonly label: string }[] = [
  { code: 'QC', label: 'Québec (QC)' },
  { code: 'ON', label: 'Ontario (ON)' },
  { code: 'BC', label: 'Colombie-Britannique (BC)' },
  { code: 'AB', label: 'Alberta (AB)' },
  { code: 'MB', label: 'Manitoba (MB)' },
  { code: 'SK', label: 'Saskatchewan (SK)' },
  { code: 'NS', label: 'Nouvelle-Écosse (NS)' },
  { code: 'NB', label: 'Nouveau-Brunswick (NB)' },
  { code: 'NL', label: 'Terre-Neuve-et-Labrador (NL)' },
  { code: 'PE', label: 'Île-du-Prince-Édouard (PE)' },
  { code: 'NT', label: 'Territoires du Nord-Ouest (NT)' },
  { code: 'YT', label: 'Yukon (YT)' },
  { code: 'NU', label: 'Nunavut (NU)' },
];

/** Normalise un code postal canadien en « A1A 1A1 » (majuscules, espace unique). */
export function normalizePostal(value: string): string {
  const compact = (value ?? '').replace(/\s+/g, '').toUpperCase();
  return compact.length === 6 ? `${compact.slice(0, 3)} ${compact.slice(3)}` : (value ?? '').trim();
}
