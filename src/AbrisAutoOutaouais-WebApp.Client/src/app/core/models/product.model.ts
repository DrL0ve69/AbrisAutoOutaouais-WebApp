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
