/**
 * Miroir EXACT du `ShelterSuggestionDto` serveur (Epic D, sous-tâche D2 —
 * `GET /products/suggest-shelters?requiredWidthCm=&requiredLengthCm=`).
 *
 * À garder synchro avec `ShelterSuggestionDto.cs` (Application/Products). JSON .NET
 * camelCase. `isTightFit` est calculé CÔTÉ SERVEUR (seuil de marge) — on lit le drapeau
 * tel quel côté client, on ne recalcule rien.
 */
export interface ShelterSuggestionDto {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly price: number;
  readonly rentalPrice: number | null;
  readonly categoryName: string;
  readonly imageUrl: string | null;
  readonly widthCm: number;
  readonly lengthCm: number;
  readonly heightCm: number | null;
  /** Marge en largeur (cm) entre l'abri et le gabarit requis. */
  readonly widthMarginCm: number;
  /** Marge en longueur (cm) entre l'abri et le gabarit requis. */
  readonly lengthMarginCm: number;
  /** Vrai si l'ajustement est serré (marge sous le seuil serveur) — affiché tel quel. */
  readonly isTightFit: boolean;
}
