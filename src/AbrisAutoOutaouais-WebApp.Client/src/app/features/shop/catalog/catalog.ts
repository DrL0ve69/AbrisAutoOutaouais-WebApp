import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ProductService } from '../../../core/services/product.service';
import { ShelterService } from '../../../core/services/shelter.service';
import { CartService } from '../../../core/services/cart.service';
import { ToastService } from '../../../core/services/toast.service';
import { CategoryDto, ProductDto, ProductSummaryDto } from '../../../core/models/product.model';
import {
  PARAMETRIC_CATEGORY_SLUGS,
  ShelterModelSummary,
} from '../../../core/models/shelter.model';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card';
import { ShelterModelCardComponent, ShelterConfigureRequest } from '../shelter-model-card/shelter-model-card';
import { ShelterConfiguratorOverlayComponent } from '../shelter-configurator-overlay/shelter-configurator-overlay';

/** Critères de tri du catalogue. */
type SortKey = 'default' | 'price-asc' | 'price-desc' | 'name-asc' | 'availability';

@Component({
  selector: 'app-catalog',
  templateUrl: './catalog.html',
  styleUrl: './catalog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ProductCardComponent,
    ShelterModelCardComponent,
    ShelterConfiguratorOverlayComponent,
    ReactiveFormsModule,
  ],
})
export class CatalogComponent implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly shelterService = inject(ShelterService);
  private readonly cartService = inject(CartService);
  private readonly toastService = inject(ToastService);

  protected readonly categories = signal<CategoryDto[]>([]);
  protected readonly products = signal<ProductDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly selectedSlug = signal<string | null>(null);

  // ── Catalogue paramétrique (rework EPIC 9) ───────────────────
  /** Modèles paramétriques de la catégorie active (vide hors mode paramétrique). */
  protected readonly shelterModels = signal<ShelterModelSummary[]>([]);
  /** Vrai si `getModels` a échoué → on affiche un message d'erreur plutôt qu'un écran blanc. */
  protected readonly shelterModelsError = signal(false);

  /** Overlay de configuration ouvert (slug + nom du modèle), ou null s'il est fermé. */
  protected readonly overlay = signal<{ slug: string; modelName: string } | null>(null);
  /** Bouton à re-focaliser à la fermeture de l'overlay (retour de focus — WCAG 2.4.3). */
  private overlayTrigger: HTMLElement | null = null;

  // ── Recherche & tri (côté client, sur la page chargée) ───────
  protected readonly searchTerm = signal('');
  protected readonly sortBy = signal<SortKey>('default');

  /**
   * Catégorie active paramétrique ? (`abris-simples` / `abris-doubles`). En mode paramétrique on
   * affiche des CARTES DE MODÈLES (référentiel `/shelters`) et l'achat passe par l'overlay ; on ne
   * charge PAS les produits fixes pour éviter les doublons.
   */
  protected readonly isParametricMode = computed(() => {
    const slug = this.selectedSlug();
    return slug !== null && PARAMETRIC_CATEGORY_SLUGS.includes(slug);
  });

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

  /** Annonce de résultats pour les lecteurs d'écran (role="status"). */
  protected readonly resultsLabel = computed(() => {
    if (this.isParametricMode()) {
      const n = this.shelterModels().length;
      return n === 0
        ? $localize`:@@shop.catalog.modelsNone:Aucun modèle configurable.`
        : n === 1
          ? $localize`:@@shop.catalog.modelsOne:1 modèle configurable.`
          : $localize`:@@shop.catalog.modelsMany:${n}:count: modèles configurables.`;
    }
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

    this.load(null);
  }

  protected selectCategory(slug: string | null): void {
    if (this.selectedSlug() === slug) {
      return;
    }
    this.selectedSlug.set(slug);
    this.load(slug);
  }

  protected onAddToCart(product: ProductSummaryDto): void {
    this.cartService.addItem(product);
    this.toastService.show(
      $localize`:@@shop.catalog.addedToast:${product.name}:name: a été ajouté au panier.`,
      'success',
    );
  }

  // ── Overlay de configuration ─────────────────────────────────
  /** Ouvre l'overlay pour le modèle demandé et mémorise le bouton déclencheur (retour de focus). */
  protected openConfigurator(request: ShelterConfigureRequest): void {
    this.overlayTrigger = request.trigger;
    this.overlay.set({ slug: request.slug, modelName: request.modelName });
  }

  /** Ferme l'overlay et rend le focus au bouton qui l'a ouvert (WCAG 2.4.3). */
  protected closeConfigurator(): void {
    this.overlay.set(null);
    this.overlayTrigger?.focus();
    this.overlayTrigger = null;
  }

  /**
   * Abri ajouté depuis l'overlay : confirme au niveau page (toast) PUIS ferme l'overlay (qui rend
   * le focus au déclencheur — L-006 : le déclencheur existe toujours, focus synchrone OK).
   */
  protected onShelterAdded(modelName: string): void {
    this.toastService.show(
      $localize`:@@shop.catalog.shelterAddedToast:${modelName}:name: a été ajouté au panier.`,
      'success',
    );
    this.closeConfigurator();
  }

  /** Charge soit les modèles paramétriques (catégorie configurable), soit les produits fixes. */
  private load(slug: string | null): void {
    if (slug !== null && PARAMETRIC_CATEGORY_SLUGS.includes(slug)) {
      this.loadShelterModels(slug);
    } else {
      this.loadProducts(slug);
    }
  }

  private loadShelterModels(slug: string): void {
    this.loading.set(true);
    this.shelterModelsError.set(false);
    this.products.set([]);
    this.shelterService.getModels(slug).subscribe({
      next: (models) => {
        this.shelterModels.set([...models]);
        this.loading.set(false);
      },
      // Dégradation gracieuse : pas d'écran blanc / spinner infini — état d'erreur explicite.
      error: () => {
        this.shelterModels.set([]);
        this.shelterModelsError.set(true);
        this.loading.set(false);
      },
    });
  }

  private loadProducts(slug: string | null): void {
    this.loading.set(true);
    this.shelterModels.set([]);
    this.shelterModelsError.set(false);
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
