/**
 * Miroir EXACT des DTO du catalogue PARAMÉTRIQUE serveur (EPIC 9.2 — `GET /shelters*`).
 *
 * À garder synchro avec, côté serveur :
 *  - `ShelterModelSummaryDto`  (Application/Shelters/Queries/GetShelterModels)
 *  - `ShelterModelDetailDto`   (Application/Shelters/Queries/GetShelterModelBySlug)
 *  - `ShelterPriceDto`         (Application/Shelters/Queries/GetShelterPrice)
 *
 * JSON .NET camelCase. ⚠️ UNITÉS MONÉTAIRES : `basePrice` et `totalPrice` sont en DOLLARS ;
 * la grille de prix (`priceGrid`) est en CENTS. Depuis le chantier « grille de prix exacte »,
 * le prix dépend de (modèle × longueur × HAUTEUR dégagée) via une GRILLE potentiellement ÉPARSE
 * — il n'y a plus de formule linéaire base + arches (`pricePerArchCents`/`archCount` n'existent
 * plus). Le PRIX AFFICHÉ vient toujours de l'endpoint `/price` (source unique de vérité — L-004) ;
 * le calcul optimiste local se contente d'un LOOKUP dans `priceGrid` (pas de recalcul de formule).
 */

/**
 * Slugs des catégories PRODUIT qui possèdent un référentiel de modèles paramétriques
 * (cf. `ShelterModelSeeder.cs`). Depuis la parité abristempo, TOUTES les catégories d'abris sont
 * désormais paramétriques (configurables) : abris simples, monopente, doubles, rangement,
 * entrée/passage et industriels. Sert au catalogue et à la fiche produit pour décider d'afficher
 * le configurateur. Les slugs de MODÈLE (`monopente`…) sont disjoints des slugs PRODUIT — on
 * raisonne ici sur la CATÉGORIE.
 */
export const PARAMETRIC_CATEGORY_SLUGS: readonly string[] = [
  'abris-simples',
  'abris-monopente',
  'abris-doubles',
  'abris-rangement',
  'abris-entree-passage',
  'abris-industriels',
];

/**
 * Table NOM de catégorie → slug de catégorie (miroir de `ProductSeeder.cs`). Le résumé d'un modèle
 * (`ShelterModelSummary`) n'expose que `categoryName` (pas le slug) ; on le rapproche ici du slug
 * pour résoudre une image de CATÉGORIE déterministe. Clés normalisées (minuscules) pour tolérer la
 * casse/les accents serveur.
 */
const CATEGORY_NAME_TO_SLUG: ReadonlyMap<string, string> = new Map([
  ['abris simples', 'abris-simples'],
  ['abris monopente', 'abris-monopente'],
  ['abris doubles', 'abris-doubles'],
  ['abris de rangement', 'abris-rangement'],
  ["abris d'entrée et de passage", 'abris-entree-passage'],
  ['abris industriels et commerciaux', 'abris-industriels'],
]);

/** Slug de catégorie de repli quand le nom n'est pas reconnu (visuel jamais vide — L-040). */
const FALLBACK_CATEGORY_SLUG = 'abris-simples';

/**
 * Résout l'URL d'une image de CATÉGORIE pour illustrer la carte d'un modèle paramétrique. Le
 * référentiel serveur n'expose pas d'image par modèle ; on illustre donc par la catégorie via un
 * SVG local déterministe (`public/images/categories/<slug>.svg`, généré par
 * `scripts/gen-category-svgs.mjs`) — gratuit et sans clé. Un nom inconnu retombe sur un visuel par
 * défaut, garantissant que la carte n'est JAMAIS vide.
 */
export function resolveShelterCategoryImage(categoryName: string | null | undefined): string {
  const slug = (categoryName && CATEGORY_NAME_TO_SLUG.get(categoryName.trim().toLowerCase())) || FALLBACK_CATEGORY_SLUG;
  return `/images/categories/${slug}.svg`;
}

/** Vue résumée d'un modèle paramétrique (listes du catalogue). */
export interface ShelterModelSummary {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly categoryName: string;
  /** Prix « à partir de » en DOLLARS (= minimum de la grille de prix du modèle). */
  readonly basePrice: number;
  readonly minLengthCm: number;
  readonly maxLengthCm: number;
  readonly lengthStepCm: number;
}

/**
 * Une cellule de la GRILLE de prix d'un modèle : un prix exact (en CENTS) pour un couple
 * (longueur, hauteur dégagée) donné. La grille peut être ÉPARSE — un couple absent signifie que
 * la combinaison n'est PAS offerte pour ce modèle (donc non commandable).
 */
export interface ShelterPriceGridEntry {
  readonly lengthCm: number;
  readonly clearHeightCm: number;
  /** Prix exact en CENTS pour ce couple (longueur, hauteur). */
  readonly priceCents: number;
}

/** Détail complet d'un modèle : résumé + grille de prix (CENTS) + options largeur/hauteur (cm). */
export interface ShelterModelDetail extends ShelterModelSummary {
  /** Id (Guid) de la catégorie produit — sert à l'édition admin (résolution PAR ID, pas par nom). */
  readonly categoryId: string;
  /**
   * Grille de prix exacte (triée côté serveur), en CENTS. Source du calcul optimiste local :
   * un simple LOOKUP par (longueur, hauteur) — pas de formule. Peut être ÉPARSE.
   */
  readonly priceGrid: readonly ShelterPriceGridEntry[];
  readonly widthOptionsCm: readonly number[];
  readonly clearHeightOptionsCm: readonly number[];
}

/**
 * Corps d'une requête de CRÉATION d'un modèle paramétrique (admin, EPIC 9.5).
 * À garder synchro avec `CreateShelterModelCommand` (Application/Shelters/Commands/CreateShelterModel).
 * L'admin ne TARIFE plus : les prix proviennent de la grille SEMÉE côté serveur, donc ni
 * `basePrice` ni `pricePerArchCents` ne sont envoyés (le contrat les a retirés).
 * `widthsCm` / `clearHeightsCm` : entiers > 0 en centimètres, au moins une valeur chacun.
 */
export interface CreateShelterModelRequest {
  readonly slug: string;
  readonly name: string;
  readonly categoryId: string;
  readonly lengthStepCm: number;
  readonly minLengthCm: number;
  readonly maxLengthCm: number;
  readonly widthsCm: number[];
  readonly clearHeightsCm: number[];
}

/**
 * Corps d'une requête de MISE À JOUR (admin) — calque la création SANS le slug (immuable à
 * l'édition). À garder synchro avec `UpdateShelterModelCommand`.
 */
export type UpdateShelterModelRequest = Omit<CreateShelterModelRequest, 'slug'>;

/**
 * Vue d'un modèle d'abri LOUABLE pour le formulaire de location (rework EPIC 9 — `GET /shelters/rentable`).
 * Miroir EXACT de `RentableShelterModelDto` côté serveur. Le tarif mensuel (`monthlyRentalPrice`, en
 * DOLLARS) est FORFAITAIRE (indépendant de la taille) ; les champs dimensionnels servent au sélecteur
 * de taille (longueur par pas + hauteur dégagée), validé côté serveur contre la grille (422 si hors grille).
 * Une LARGEUR par modèle (`widthCm`). `priceGrid` est en CENTS (cohérent avec `ShelterPriceGridEntry`).
 */
export interface RentableShelterModel {
  readonly slug: string;
  readonly name: string;
  readonly categoryName: string;
  /** Tarif mensuel forfaitaire en DOLLARS (toujours non nul : la query ne retourne que les louables). */
  readonly monthlyRentalPrice: number;
  readonly minLengthCm: number;
  readonly maxLengthCm: number;
  readonly lengthStepCm: number;
  /** Largeur unique du modèle (cm). */
  readonly widthCm: number;
  readonly clearHeightOptionsCm: readonly number[];
  /** Grille de prix exacte (CENTS) — sert au garde-fou dense côté client (combinaison offerte ?). */
  readonly priceGrid: readonly ShelterPriceGridEntry[];
}

/** Type résolu d'un slug de catalogue (`GET /catalog/{slug}/type`) — voir `CatalogSlugTypeDto` serveur. */
export interface CatalogSlugType {
  readonly type: 'shelter' | 'product';
}

/**
 * Résultat d'un calcul de prix serveur pour un couple (longueur, hauteur dégagée) configuré.
 * Le couple doit exister dans la grille du modèle, sinon le serveur répond 422 (combinaison non
 * offerte). `totalPrice` en DOLLARS. À garder synchro avec `ShelterPriceDto`.
 */
export interface ShelterPrice {
  readonly modelId: string;
  readonly slug: string;
  readonly lengthCm: number;
  /** Hauteur dégagée (cm) du couple tarifé. */
  readonly clearHeightCm: number;
  /** Prix total en DOLLARS. */
  readonly totalPrice: number;
}
