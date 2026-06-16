export interface ProductSummaryDto {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly price: number;
  readonly rentalPrice: number | null;
  readonly isAvailable: boolean;
  readonly categoryName: string;
  readonly thumbnailUrl: string | null;
}

export interface ProductDto extends ProductSummaryDto {
  readonly description: string | null;
  readonly stock: number;
  readonly imageUrls: readonly string[];
  /** Dimensions hors-tout en centimètres — null si non renseignées. */
  readonly widthCm: number | null;
  readonly lengthCm: number | null;
  readonly heightCm: number | null;
  /** Marque et modèle — null si non renseignés (toiles, accessoires). */
  readonly brand: string | null;
  readonly model: string | null;
}

export interface PaginatedList<T> {
  readonly items: readonly T[];
  readonly totalCount: number;
  readonly pageNumber: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly hasNext: boolean;
  readonly hasPrev: boolean;
}

export interface CategoryDto {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly productCount: number;
}

export interface ProductQuery {
  readonly page?: number;
  readonly pageSize?: number;
  readonly category?: string;
  readonly search?: string;
}

/** Charge utile pour créer un produit (POST /products). */
export interface CreateProductRequest {
  readonly name: string;
  readonly description: string;
  readonly price: number;
  readonly stockQuantity: number;
  readonly categoryId: string;
  /** Dimensions hors-tout en centimètres — null si non renseignées. */
  readonly widthCm: number | null;
  readonly lengthCm: number | null;
  readonly heightCm: number | null;
  /** Marque et modèle — null si non renseignés. */
  readonly brand: string | null;
  readonly model: string | null;
}

/** Charge utile pour mettre à jour un produit (PUT /products/{id}). */
export interface UpdateProductRequest {
  readonly name: string;
  readonly description: string;
  readonly price: number;
  readonly stock: number;
  readonly categoryId: string;
  /** Dimensions hors-tout en centimètres — null si non renseignées. */
  readonly widthCm: number | null;
  readonly lengthCm: number | null;
  readonly heightCm: number | null;
  /** Marque et modèle — null si non renseignés. */
  readonly brand: string | null;
  readonly model: string | null;
}

/**
 * Résout l'URL de l'image d'un produit pour l'affichage.
 *
 * Le frontend fournit un visuel SVG soigné par slug
 * (`public/images/products/<slug>.svg`) — ce sont les seuls fichiers qui
 * existent aujourd'hui. On les utilise par défaut. Le jour où de vraies photos
 * matricielles seront servies (via `imageUrls` / `thumbnailUrl` pointant vers
 * des fichiers réellement présents), elles restent prioritaires. En dernier
 * recours, le composant gère l'événement `(error)` pour masquer l'image cassée
 * et afficher le placeholder emoji.
 */
export function resolveProductImage(
  product: Pick<ProductSummaryDto, 'slug' | 'thumbnailUrl'> &
    Partial<Pick<ProductDto, 'imageUrls'>>,
): string {
  // Slug-based SVG : visuel garanti côté frontend.
  if (product.slug) {
    return `/images/products/${product.slug}.svg`;
  }
  return product.thumbnailUrl ?? product.imageUrls?.[0] ?? '';
}
