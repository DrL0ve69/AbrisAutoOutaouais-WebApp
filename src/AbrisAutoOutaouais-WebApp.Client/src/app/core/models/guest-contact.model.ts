/**
 * Coordonnées d'un visiteur NON connecté, saisies à la confirmation d'un achat / d'une location /
 * d'une réservation (parcours invité, Épic F). Correspond au `GuestContact` C# (sérialisé en
 * camelCase). Le backend l'utilise pour trouver-ou-créer un « compte express » rattaché par courriel.
 *
 * Source UNIQUE de cette forme côté client (L-018) : réimportée par les trois charges de création
 * (commande, location, réservation), jamais redéclarée.
 *
 * FRONTIÈRE : non nul UNIQUEMENT pour un invité ; pour un utilisateur connecté la charge l'omet
 * (null/absent) — le backend résout alors `CustomerId` = utilisateur courant.
 */
export interface GuestContactRequest {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string | null;
}
