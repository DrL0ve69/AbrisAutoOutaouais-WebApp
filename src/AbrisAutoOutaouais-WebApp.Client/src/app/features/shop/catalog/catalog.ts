import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
import { ToastService } from '../../../core/services/toast.service';
import { CategoryDto, ProductDto, ProductSummaryDto } from '../../../core/models/product.model';
import { PARAMETRIC_CATEGORY_SLUGS } from '../../../core/models/shelter.model';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card';

/** Critères de tri du catalogue. */
type SortKey = 'default' | 'price-asc' | 'price-desc' | 'name-asc' | 'availability';

@Component({
  selector: 'app-catalog',
  templateUrl: './catalog.html',
  styleUrl: './catalog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProductCardComponent, ReactiveFormsModule, RouterLink],
})
export class CatalogComponent implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly cartService = inject(CartService);
  private readonly toastService = inject(ToastService);

  protected readonly categories = signal<CategoryDto[]>([]);
  protected readonly products = signal<ProductDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly selectedSlug = signal<string | null>(null);

  // ── Recherche & tri (côté client, sur la page chargée) ───────
  protected readonly searchTerm = signal('');
  protected readonly sortBy = signal<SortKey>('default');

  /** Produits filtrés par la recherche puis triés selon le critère choisi. */
  protected readonly visibleProducts = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const list = term
      ? this.products().filter((p) => p.name.toLowerCase().includes(term))
      : [...this.products()];

    switch (this.sortBy()) {
      case 'price-asc':
        return list.sort((a, b) => a.price - b.price);
      case 'price-desc':
        return list.sort((a, b) => b.price - a.price);
      case 'name-asc':
        return list.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      case 'availability':
        return list.sort((a, b) => Number(b.isAvailable) - Number(a.isAvailable));
      default:
        return list;
    }
  });

  /**
   * Catégories paramétriques présentes dans le catalogue (EPIC 9.3) → on propose le configurateur
   * de dimensions. On filtre les catégories chargées par leur slug (référentiel partagé).
   */
  protected readonly parametricCategories = computed(() =>
    this.categories().filter(c => PARAMETRIC_CATEGORY_SLUGS.includes(c.slug)),
  );

  /** Annonce de résultats pour les lecteurs d'écran (role="status"). */
  protected readonly resultsLabel = computed(() => {
    const n = this.visibleProducts().length;
    return n === 0
      ? $localize`:@@shop.catalog.resultsNone:Aucun produit ne correspond.`
      : n === 1
        ? $localize`:@@shop.catalog.resultsOne:1 produit affiché.`
        : $localize`:@@shop.catalog.resultsMany:${n}:count: produits affichés.`;
  });

  protected onSearch(value: string): void {
    this.searchTerm.set(value);
  }

  protected onSort(value: string): void {
    this.sortBy.set(value as SortKey);
  }

  ngOnInit(): void {
    this.productService.getCategories().subscribe({
      next: (cats) => this.categories.set(cats),
    });

    this.loadProducts(null);
  }

  protected selectCategory(slug: string | null): void {
    if (this.selectedSlug() === slug) {
      return;
    }
    this.selectedSlug.set(slug);
    this.loadProducts(slug);
  }

  protected onAddToCart(product: ProductSummaryDto): void {
    this.cartService.addItem(product);
    this.toastService.show(
      $localize`:@@shop.catalog.addedToast:${product.name}:name: a été ajouté au panier.`,
      'success',
    );
  }

  private loadProducts(slug: string | null): void {
    this.loading.set(true);
    this.productService
      .getProducts({ page: 1, pageSize: 50, category: slug ?? undefined })
      .subscribe({
        next: (res) => {
          this.products.set([...res.items]);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
