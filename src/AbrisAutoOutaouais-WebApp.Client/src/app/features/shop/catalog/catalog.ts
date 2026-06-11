import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ProductService } from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  CategoryDto,
  ProductDto,
  ProductSummaryDto,
} from '../../../core/models/product.model';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card';

@Component({
  selector: 'app-catalog',
  templateUrl: './catalog.html',
  styleUrl: './catalog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProductCardComponent],
})
export class CatalogComponent implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly cartService = inject(CartService);
  private readonly toastService = inject(ToastService);

  protected readonly categories = signal<CategoryDto[]>([]);
  protected readonly products = signal<ProductDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly selectedSlug = signal<string | null>(null);

  ngOnInit(): void {
    this.productService.getCategories().subscribe({
      next: cats => this.categories.set(cats),
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
        next: res => {
          this.products.set([...res.items]);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
