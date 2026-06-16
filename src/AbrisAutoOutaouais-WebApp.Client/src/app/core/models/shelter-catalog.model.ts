/**
 * Miroir EXACT du catalogue serveur (Épic G, G2 — `GET /products/shelter-catalog`).
 *
 * À garder synchro avec `BrandCatalogDto`/`ModelCatalogDto` (Application/Products/Queries/
 * GetShelterCatalog). JSON .NET camelCase. Dérivé des produits qui portent une marque ET un
 * modèle : alimente les listes déroulantes marque → modèle du formulaire d'installation.
 */
export interface BrandCatalog {
  readonly brand: string;
  readonly models: readonly ModelCatalog[];
}

/** Un modèle distinct d'une marque, avec son slug produit et ses dimensions hors-tout (cm). */
export interface ModelCatalog {
  readonly model: string;
  readonly slug: string;
  /** Dimensions hors-tout en cm — nullables (certains modèles ne les publient pas). */
  readonly widthCm: number | null;
  readonly lengthCm: number | null;
  readonly heightCm: number | null;
}
