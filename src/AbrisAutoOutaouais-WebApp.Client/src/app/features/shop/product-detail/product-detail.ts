import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ProductDto, resolveProductImage } from '../../../core/models/product.model';
import { PARAMETRIC_CATEGORY_SLUG_BY_NAME } from '../../../core/models/shelter.model';
import { CartService } from '../../../core/services/cart.service';
import { ToastService } from '../../../core/services/toast.service';
import { Shelter3dViewerComponent } from '../../../shared/components/shelter-3d-viewer/shelter-3d-viewer';

@Component({
  selector: 'app-product-detail',
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, RouterLink, Shelter3dViewerComponent],
})
export class ProductDetailComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly cartService = inject(CartService);
  private readonly toastService = inject(ToastService);

  // Lié depuis le paramètre de route (withComponentInputBinding activé)
  readonly slug = input.required<string>();

  protected readonly product = signal<ProductDto | null>(null);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);

  // Image SVG dérivée du slug, avec repli emoji si introuvable.
  protected readonly imageFailed = signal(false);
  protected readonly imageSrc = computed(() => {
    const p = this.product();
    return p ? resolveProductImage(p) : '';
  });

  // Vrai si les 3 dimensions hors-tout sont renseignées (et non nulles) → on propose la 3D.
  protected readonly has3dDims = computed(() => {
    const p = this.product();
    return (
      !!p &&
      p.widthCm !== null &&
      p.widthCm > 0 &&
      p.lengthCm !== null &&
      p.lengthCm > 0 &&
      p.heightCm !== null &&
      p.heightCm > 0
    );
  });

  /**
   * Slug de catégorie paramétrique du produit (EPIC 9.3), s'il en a une → lien vers la liste des
   * modèles configurables. La fiche n'expose que `categoryName` ; on le mappe au slug du référentiel
   * partagé. `null` pour un produit à taille fixe (toiles, accessoires) : aucun lien proposé.
   */
  protected readonly parametricCategorySlug = computed(() => {
    const p = this.product();
    return p ? (PARAMETRIC_CATEGORY_SLUG_BY_NAME[p.categoryName] ?? null) : null;
  });

  protected onImageError(): void {
    this.imageFailed.set(true);
  }

  ngOnInit(): void {
    this.http
      .get<ProductDto>(`${environment.apiUrl}/products/${this.slug()}`)
      .subscribe({
        next: product => {
          this.product.set(product);
          this.loading.set(false);
        },
        error: () => {
          this.notFound.set(true);
          this.loading.set(false);
        },
      });
  }

  protected onAddToCart(): void {
    const product = this.product();
    if (!product) {
      return;
    }
    this.cartService.addItem(product);
    this.toastService.show(
      $localize`:@@shop.detail.addedToast:${product.name}:name: a été ajouté au panier.`,
      'success',
    );
  }
}
