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
import { catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ProductDto, resolveProductImage } from '../../../core/models/product.model';
import { ShelterModelDetail } from '../../../core/models/shelter.model';
import { ShelterService } from '../../../core/services/shelter.service';
import { CartService } from '../../../core/services/cart.service';
import { ToastService } from '../../../core/services/toast.service';
import { Shelter3dViewerComponent } from '../../../shared/components/shelter-3d-viewer/shelter-3d-viewer';
import {
  DimensionConfiguratorComponent,
  ShelterConfiguration,
} from '../dimension-configurator/dimension-configurator';
import { formatFeetInches } from '../../mesurer/util/feet-inches.util';

/** État de résolution de la fiche `:slug` (rework EPIC 9). */
type DetailMode = 'loading' | 'shelter' | 'product' | 'notFound';

@Component({
  selector: 'app-product-detail',
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, RouterLink, Shelter3dViewerComponent, DimensionConfiguratorComponent],
})
export class ProductDetailComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly shelterService = inject(ShelterService);
  private readonly cartService = inject(CartService);
  private readonly toastService = inject(ToastService);

  // Lié depuis le paramètre de route (withComponentInputBinding activé)
  readonly slug = input.required<string>();

  /**
   * Résolution DOUBLE (rework EPIC 9) : le même `:slug` peut désigner un MODÈLE paramétrique
   * (`/shelters/:slug`) OU un produit fixe (`/products/:slug`). On tente d'abord le modèle ; un 404
   * (ou toute erreur) bascule sur le produit ; un 404 produit aboutit à `notFound`.
   */
  protected readonly mode = signal<DetailMode>('loading');

  // ── Mode « produit fixe » ───────────────────────────────────
  protected readonly product = signal<ProductDto | null>(null);

  // ── Mode « modèle paramétrique » ────────────────────────────
  protected readonly shelterModel = signal<ShelterModelDetail | null>(null);
  /** Dernière configuration émise (prix serveur confirmé) — null tant qu'aucun prix confirmé. */
  protected readonly configuration = signal<ShelterConfiguration | null>(null);
  /** Vrai dès qu'un prix serveur est confirmé → bouton d'ajout réellement actif (L-024). */
  protected readonly canAddShelter = computed(() => this.configuration() !== null);
  /** Annonce d'ajout au panier (aria-live) — repassée à '' avant chaque réannonce (L-027). */
  protected readonly addAnnouncement = signal('');

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

  protected formatFeetInches = formatFeetInches;

  protected onImageError(): void {
    this.imageFailed.set(true);
  }

  ngOnInit(): void {
    // 1) Tente le modèle paramétrique ; `catchError` → `null` (404/erreur) sans casser le flux.
    this.shelterService
      .getModel(this.slug())
      .pipe(catchError(() => of(null)))
      .subscribe(model => {
        if (model) {
          this.shelterModel.set(model);
          this.mode.set('shelter');
        } else {
          // 2) Repli produit fixe.
          this.loadProduct();
        }
      });
  }

  private loadProduct(): void {
    this.http
      .get<ProductDto>(`${environment.apiUrl}/products/${this.slug()}`)
      .subscribe({
        next: product => {
          this.product.set(product);
          this.mode.set('product');
        },
        error: () => this.mode.set('notFound'),
      });
  }

  // `null` = config devenue non commandable (recalcul en cours / couple non offert) → on invalide
  // l'état d'ajout, sinon une config périmée resterait commandable après bascule (L-046).
  protected onConfigurationChange(config: ShelterConfiguration | null): void {
    this.configuration.set(config);
  }

  /** Ajoute le produit fixe au panier. */
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

  /** Ajoute l'abri configuré au panier. No-op tant qu'aucun prix serveur n'est confirmé (L-024). */
  protected onAddShelterToCart(): void {
    const config = this.configuration();
    if (config === null) return;
    this.cartService.addShelter(config);
    const length = this.formatFeetInches(config.lengthCm);
    this.addAnnouncement.set('');
    this.addAnnouncement.set(
      $localize`:@@shop.detail.shelterAddedAnnounce:${config.modelName}:model: (${length}:length:) ajouté au panier.`,
    );
  }
}
