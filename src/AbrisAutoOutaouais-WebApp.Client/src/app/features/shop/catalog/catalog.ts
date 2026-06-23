import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
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
  private readonly route = inject(ActivatedRoute);

  protected readonly categories = signal<CategoryDto[]>([]);
  protected readonly products = signal<ProductDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly selectedSlug = signal<string | null>(null);

  // ── Catalogue paramétrique (rework EPIC 9) ───────────────────
  /** Modèles paramétriques de la catégorie active (vide hors mode paramétrique). */
  protected readonly shelterModels = signal<ShelterModelSummary[]>([]);
  /** Vrai si `getModels` a échoué → on affiche un message d'erreur plutôt qu'un écran blanc. */
  protected readonly shelterModelsError = signal(false);
  /**
   * Vrai si le chargement des PRODUITS de la vue « Tous » a échoué. Distinct de
   * `shelterModelsError` : en vue mixte les deux listes ont chacune leur propre état d'échec, et un
   * échec NE DOIT PAS être masqué en faux état vide (sinon une panne backend ressemble à un catalogue
   * vide). Une panne PARTIELLE (une liste OK) n'affiche PAS l'erreur — l'autre liste reste visible.
   */
  protected readonly productsError = signal(false);

  /** Overlay de configuration ouvert (slug + nom + longueur initiale opt.), ou null s'il est fermé. */
  protected readonly overlay = signal<{
    slug: string;
    modelName: string;
    initialLengthCm: number | null;
  } | null>(null);
  /** Bouton à re-focaliser à la fermeture de l'overlay (retour de focus — WCAG 2.4.3). */
  private overlayTrigger: HTMLElement | null = null;

  /** Demande d'ouverture différée par deep-link (`?configure=&length=`), traitée au chargement des modèles. */
  private pendingDeepLink: { slug: string; lengthCm: number | null } | null = null;

  // ── Recherche & tri (côté client, sur la page chargée) ───────
  protected readonly searchTerm = signal('');
  protected readonly sortBy = signal<SortKey>('default');

  /**
   * Catégorie active paramétrique ? (toutes les catégories d'abris le sont désormais — voir
   * `PARAMETRIC_CATEGORY_SLUGS`). En mode paramétrique on affiche des CARTES DE MODÈLES (référentiel
   * `/shelters`) et l'achat passe par l'overlay ; on ne charge PAS les produits fixes pour éviter
   * les doublons.
   */
  protected readonly isParametricMode = computed(() => {
    const slug = this.selectedSlug();
    return slug !== null && PARAMETRIC_CATEGORY_SLUGS.includes(slug);
  });

  /**
   * Vue « Tous » (aucune catégorie sélectionnée) : vue MIXTE — TOUS les modèles d'abris paramétriques
   * (cartes → overlay, dimensions obligatoires) PLUS les produits NON-abris restants (toiles,
   * pièces/accessoires : ajout direct). On combine donc une liste de modèles et une liste de produits.
   */
  protected readonly isAllMode = computed(() => this.selectedSlug() === null);

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
   * Modèles d'abris filtrés par la recherche (vue « Tous » et catégorie paramétrique). Le tri
   * « Tous » privilégie la pertinence : on garde l'ordre serveur (Name puis Slug — déterministe).
   */
  protected readonly visibleModels = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const list = this.shelterModels();
    return term ? list.filter((m) => m.name.toLowerCase().includes(term)) : list;
  });

  /** Annonce de résultats pour les lecteurs d'écran (role="status"). */
  protected readonly resultsLabel = computed(() => {
    if (this.isParametricMode()) {
      const n = this.visibleModels().length;
      return n === 0
        ? $localize`:@@shop.catalog.modelsNone:Aucun modèle configurable.`
        : n === 1
          ? $localize`:@@shop.catalog.modelsOne:1 modèle configurable.`
          : $localize`:@@shop.catalog.modelsMany:${n}:count: modèles configurables.`;
    }
    // « Tous » et catégories non-abris : on compte les éléments réellement affichés (modèles + produits).
    const n = this.visibleModels().length + this.visibleProducts().length;
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

    // Deep-link depuis `/mesurer` (EPIC 10) : `?category=&configure=&length=`. Si une catégorie
    // paramétrique est demandée, on la sélectionne (charge ses modèles) ; si un slug de modèle est
    // fourni, on mémorise l'ouverture de l'overlay (traitée APRÈS le chargement des modèles, pour
    // résoudre le nom du modèle). À défaut, comportement normal (catégorie « Tous »).
    const params = this.route.snapshot.queryParamMap;
    const category = params.get('category');
    const configure = params.get('configure');
    const lengthParam = params.get('length');

    if (configure) {
      const parsed = lengthParam ? Number(lengthParam) : NaN;
      this.pendingDeepLink = {
        slug: configure,
        lengthCm: Number.isFinite(parsed) ? parsed : null,
      };
    }

    if (category !== null && PARAMETRIC_CATEGORY_SLUGS.includes(category)) {
      this.selectedSlug.set(category);
      this.load(category);
    } else {
      this.load(null);
      // Deep-link « configure » SANS catégorie paramétrique valide : `loadShelterModels` ne tournera
      // pas, donc on ouvre l'overlay DIRECTEMENT (le configurateur recharge le modèle par slug). Le
      // nom reste vide ici → `displayTitle` de l'overlay fournit un repli accessible (jamais vide).
      if (this.pendingDeepLink) {
        const { slug: modelSlug, lengthCm } = this.pendingDeepLink;
        this.pendingDeepLink = null;
        this.openConfiguratorFromDeepLink(modelSlug, lengthCm);
      }
    }
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
    this.overlay.set({ slug: request.slug, modelName: request.modelName, initialLengthCm: null });
  }

  /**
   * Ouvre l'overlay depuis un DEEP-LINK (`/mesurer` → `?configure=&length=`) : pas de bouton
   * déclencheur DOM (`overlayTrigger = null` → à la fermeture le focus retombe sur le flux normal,
   * pas de retour vers un élément inexistant). Le nom du modèle est résolu dans les modèles chargés ;
   * s'il est introuvable, on ouvre tout de même avec une chaîne vide (le configurateur recharge le
   * modèle par slug et le titre reste cohérent une fois chargé).
   */
  private openConfiguratorFromDeepLink(slug: string, lengthCm: number | null): void {
    const model = this.shelterModels().find((m) => m.slug === slug);
    this.overlayTrigger = null;
    this.overlay.set({
      slug,
      modelName: model?.name ?? '',
      initialLengthCm: lengthCm,
    });
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

  /**
   * Charge la vue selon la catégorie active :
   *  - catégorie d'abris paramétrique → cartes de MODÈLES (achat via overlay) ;
   *  - « Tous » (slug null) → vue MIXTE : TOUS les modèles d'abris + les produits NON-abris restants ;
   *  - catégorie NON-abris (toiles, pièces/accessoires) → produits fixes uniquement.
   */
  private load(slug: string | null): void {
    if (slug !== null && PARAMETRIC_CATEGORY_SLUGS.includes(slug)) {
      this.loadShelterModels(slug);
    } else if (slug === null) {
      this.loadAll();
    } else {
      this.loadProducts(slug);
    }
  }

  /** Charge les modèles d'une catégorie paramétrique (les produits fixes ne sont pas affichés). */
  private loadShelterModels(slug: string): void {
    this.loading.set(true);
    this.shelterModelsError.set(false);
    this.productsError.set(false);
    this.products.set([]);
    this.shelterService.getModels(slug).subscribe({
      next: (models) => {
        this.shelterModels.set([...models]);
        this.loading.set(false);
        this.processPendingDeepLink();
      },
      // Dégradation gracieuse : pas d'écran blanc / spinner infini — état d'erreur explicite.
      error: () => {
        this.shelterModels.set([]);
        this.shelterModelsError.set(true);
        this.loading.set(false);
      },
    });
  }

  /**
   * Vue « Tous » : combine TOUS les modèles d'abris (cartes → overlay) et les produits NON-abris
   * restants (le backend ne renvoie plus que ceux-là). Les deux requêtes sont indépendantes ;
   * l'échec des modèles n'efface pas les produits (et inversement). On retire le spinner dès que
   * les DEUX ont répondu pour éviter un état partiel clignotant.
   */
  private loadAll(): void {
    this.loading.set(true);
    this.shelterModelsError.set(false);
    this.productsError.set(false);
    forkJoin({
      models: this.shelterService.getModels().pipe(
        catchError(() => {
          this.shelterModelsError.set(true);
          return of<ShelterModelSummary[]>([]);
        }),
      ),
      products: this.productService.getProducts({ page: 1, pageSize: 50 }).pipe(
        catchError(() => {
          this.productsError.set(true);
          return of({ items: [] as ProductDto[] });
        }),
      ),
    }).subscribe(({ models, products }) => {
      this.shelterModels.set([...models]);
      this.products.set([...(products.items ?? [])]);
      this.loading.set(false);
      this.processPendingDeepLink();
    });
  }

  private loadProducts(slug: string): void {
    this.loading.set(true);
    this.shelterModels.set([]);
    this.shelterModelsError.set(false);
    this.productsError.set(false);
    this.productService
      .getProducts({ page: 1, pageSize: 50, category: slug })
      .subscribe({
        next: (res) => {
          this.products.set([...res.items]);
          this.loading.set(false);
        },
        error: () => {
          this.productsError.set(true);
          this.loading.set(false);
        },
      });
  }

  /** Ouvre l'overlay du deep-link en attente une fois les modèles chargés (nom résolu). */
  private processPendingDeepLink(): void {
    if (this.pendingDeepLink) {
      const { slug: modelSlug, lengthCm } = this.pendingDeepLink;
      this.pendingDeepLink = null;
      this.openConfiguratorFromDeepLink(modelSlug, lengthCm);
    }
  }
}
