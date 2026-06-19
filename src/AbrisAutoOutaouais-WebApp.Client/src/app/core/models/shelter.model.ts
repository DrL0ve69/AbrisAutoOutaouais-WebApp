/**
 * Miroir EXACT des DTO du catalogue PARAMÉTRIQUE serveur (EPIC 9.2 — `GET /shelters*`).
 *
 * À garder synchro avec, côté serveur :
 *  - `ShelterModelSummaryDto`  (Application/Shelters/Queries/GetShelterModels)
 *  - `ShelterModelDetailDto`   (Application/Shelters/Queries/GetShelterModelBySlug)
 *  - `ShelterPriceDto`         (Application/Shelters/Queries/GetShelterPrice)
 *
 * JSON .NET camelCase. ⚠️ UNITÉS MONÉTAIRES : `basePrice` et `totalPrice` sont en DOLLARS ;
 * `pricePerArchCents` est en CENTS. Le PRIX AFFICHÉ vient toujours de l'endpoint `/price`
 * (source unique de vérité — L-004) ; tout calcul optimiste local doit reproduire EXACTEMENT
 * `Domain/Services/ShelterPriceCalculator.cs`.
 */

/**
 * Slugs des catégories PRODUIT qui possèdent un référentiel de modèles paramétriques
 * (cf. `ShelterModelSeeder.cs` : modèles rattachés à `abris-simples` / `abris-doubles`).
 * Sert au catalogue et à la fiche produit pour décider d'afficher le configurateur. Les slugs
 * de MODÈLE (`simple`…) sont disjoints des slugs PRODUIT — on raisonne ici sur la CATÉGORIE.
 */
export const PARAMETRIC_CATEGORY_SLUGS: readonly string[] = ['abris-simples', 'abris-doubles'];

/**
 * Noms des catégories paramétriques (la fiche produit n'expose que `categoryName`, pas le slug) ;
 * mappe le nom canonique au slug pour router vers la liste des modèles. À garder synchro avec
 * `ProductSeeder.cs` (`ProductCategory.Create(name, slug)`).
 */
export const PARAMETRIC_CATEGORY_SLUG_BY_NAME: Readonly<Record<string, string>> = {
  'Abris simples': 'abris-simples',
  'Abris doubles': 'abris-doubles',
};

/** Vue résumée d'un modèle paramétrique (listes du catalogue). */
export interface ShelterModelSummary {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly categoryName: string;
  /** Prix de base en DOLLARS (longueur minimale, 0 arche supplémentaire). */
  readonly basePrice: number;
  readonly minLengthCm: number;
  readonly maxLengthCm: number;
  readonly lengthStepCm: number;
}

/** Détail complet d'un modèle : résumé + tarif par arche (CENTS) + options largeur/hauteur (cm). */
export interface ShelterModelDetail extends ShelterModelSummary {
  /** Id (Guid) de la catégorie produit — sert à l'édition admin (résolution PAR ID, pas par nom). */
  readonly categoryId: string;
  /** Prix d'une arche supplémentaire en CENTS (≠ dollars — ne pas mélanger). */
  readonly pricePerArchCents: number;
  readonly widthOptionsCm: readonly number[];
  readonly clearHeightOptionsCm: readonly number[];
}

/**
 * Corps d'une requête de CRÉATION d'un modèle paramétrique (admin, EPIC 9.5).
 * À garder synchro avec `CreateShelterModelCommand` (Application/Shelters/Commands/CreateShelterModel).
 * ⚠️ UNITÉS : `basePrice` est en DOLLARS ; `pricePerArchCents` est en CENTS.
 * `widthsCm` / `clearHeightsCm` : entiers > 0 en centimètres, au moins une valeur chacun.
 */
export interface CreateShelterModelRequest {
  readonly slug: string;
  readonly name: string;
  readonly categoryId: string;
  readonly lengthStepCm: number;
  readonly minLengthCm: number;
  readonly maxLengthCm: number;
  /** DOLLARS. */
  readonly basePrice: number;
  /** CENTS. */
  readonly pricePerArchCents: number;
  readonly widthsCm: number[];
  readonly clearHeightsCm: number[];
}

/**
 * Corps d'une requête de MISE À JOUR (admin) — calque la création SANS le slug (immuable à
 * l'édition). À garder synchro avec `UpdateShelterModelCommand`.
 */
export type UpdateShelterModelRequest = Omit<CreateShelterModelRequest, 'slug'>;

/** Résultat d'un calcul de prix serveur (longueur configurée). `totalPrice` en DOLLARS. */
export interface ShelterPrice {
  readonly modelId: string;
  readonly slug: string;
  readonly lengthCm: number;
  /** Nombre d'arches supplémentaires au-delà de la longueur de base. */
  readonly archCount: number;
  /** Prix total en DOLLARS. */
  readonly totalPrice: number;
}
