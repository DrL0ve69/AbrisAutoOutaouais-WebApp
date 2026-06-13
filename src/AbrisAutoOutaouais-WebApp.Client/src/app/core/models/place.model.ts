/**
 * Miroir EXACT du `PlaceSuggestionDto` serveur (proxy Places — Epic C, C2).
 * La terminologie reprend `AddressDto` (civicNumber / street / city / province /
 * postalCode) pour que l'autofill côté client patche les formulaires sans
 * transformation (leçon L-004 : un format partagé, validé pareil partout).
 *
 * `lat` / `lng` sont portés dès maintenant pour l'Epic D (géocodage / carte) ;
 * ils ne sont PAS utilisés ici mais évitent une rupture de contrat plus tard.
 */
export interface PlaceSuggestionDto {
  readonly label: string;
  readonly civicNumber: string | null;
  readonly street: string;
  readonly city: string;
  readonly province: string;
  readonly postalCode: string | null;
  readonly lat: number | null;
  readonly lng: number | null;
}

/** Réponse de `GET /places/lookup-postal-code` — code postal résolu ou `null`. */
export interface PostalCodeLookupDto {
  readonly postalCode: string | null;
}
