import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../../core/services/product.service';
import { AdminProductService } from '../../../core/services/admin-product.service';
import { ToastService } from '../../../core/services/toast.service';
import { CategoryDto, ProductDto } from '../../../core/models/product.model';

type FormMode = 'create' | 'edit';

/**
 * Administration du catalogue — liste, création, édition et suppression de produits.
 * Accès protégé par authGuard + adminGuard (cf. app.routes.ts → /admin).
 * La catégorie est modifiable en création comme en édition (PUT /products l'applique).
 * WCAG AA : table sémantique, libellés associés, messages d'erreur role="alert",
 * confirmation accessible.
 */
@Component({
  selector: 'app-admin-products',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, CurrencyPipe],
  templateUrl: './products.html',
  styleUrl: './products.scss',
})
export class AdminProductsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly products = inject(ProductService);
  private readonly admin = inject(AdminProductService);
  private readonly toast = inject(ToastService);

  protected readonly items = signal<readonly ProductDto[]>([]);
  protected readonly categories = signal<readonly CategoryDto[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly mode = signal<FormMode>('create');
  protected readonly editingId = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);

  /** Id du produit en attente de confirmation de suppression. */
  protected readonly pendingDeleteId = signal<string | null>(null);

  protected readonly isEditing = computed(() => this.mode() === 'edit');

  // Dimensions optionnelles (cm) : nullables, mais si renseignées → bornes 50–2000
  // (calque exact des validators serveur Create/Update — cf. ProductDimensions).
  private dimensionControl() {
    return this.fb.control<number | null>(null, [Validators.min(50), Validators.max(2000)]);
  }

  protected readonly form = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
    description: this.fb.nonNullable.control(''),
    price: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0.01)]),
    stock: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
    categoryId: this.fb.nonNullable.control('', [Validators.required]),
    widthCm: this.dimensionControl(),
    lengthCm: this.dimensionControl(),
    heightCm: this.dimensionControl(),
  });

  protected get nameCtrl() { return this.form.controls.name; }
  protected get priceCtrl() { return this.form.controls.price; }
  protected get stockCtrl() { return this.form.controls.stock; }
  protected get categoryCtrl() { return this.form.controls.categoryId; }
  protected get widthCtrl() { return this.form.controls.widthCm; }
  protected get lengthCtrl() { return this.form.controls.lengthCm; }
  protected get heightCtrl() { return this.form.controls.heightCm; }

  constructor() {
    this.loadCategories();
    this.loadProducts();
  }

  private loadCategories(): void {
    this.products.getCategories().subscribe({
      next: cats => this.categories.set(cats),
      error: () =>
        this.toast.show($localize`:@@admin.products.toast.loadError:Échec du chargement.`, 'error'),
    });
  }

  protected loadProducts(): void {
    this.loading.set(true);
    this.products.getProducts({ pageSize: 100 }).subscribe({
      next: page => {
        this.items.set(page.items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.show($localize`:@@admin.products.toast.loadError:Échec du chargement.`, 'error');
      },
    });
  }

  /** Résout le categoryId d'un produit par son nom (le DTO liste n'expose pas l'id). */
  private categoryIdForName(name: string): string {
    return this.categories().find(c => c.name === name)?.id ?? '';
  }

  protected startCreate(): void {
    this.mode.set('create');
    this.editingId.set(null);
    this.formError.set(null);
    this.form.reset({
      name: '', description: '', price: 0, stock: 0, categoryId: '',
      widthCm: null, lengthCm: null, heightCm: null,
    });
    this.categoryCtrl.enable();
  }

  protected startEdit(product: ProductDto): void {
    this.mode.set('edit');
    this.editingId.set(product.id);
    this.formError.set(null);
    this.form.reset({
      name: product.name,
      description: product.description ?? '',
      price: product.price,
      stock: product.stock,
      categoryId: this.categoryIdForName(product.categoryName),
      widthCm: product.widthCm,
      lengthCm: product.lengthCm,
      heightCm: product.heightCm,
    });
    // La catégorie est modifiable : PUT /products applique le changement.
    this.categoryCtrl.enable();
  }

  protected cancelEdit(): void {
    this.startCreate();
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    const v = this.form.getRawValue();
    // Champ vide → null (pas 0) : une dimension non renseignée doit rester absente.
    const dims = {
      widthCm: this.toDimension(v.widthCm),
      lengthCm: this.toDimension(v.lengthCm),
      heightCm: this.toDimension(v.heightCm),
    };

    if (this.isEditing()) {
      const id = this.editingId()!;
      this.admin
        .updateProduct(id, {
          name: v.name,
          description: v.description,
          price: v.price,
          stock: v.stock,
          categoryId: v.categoryId,
          ...dims,
        })
        .subscribe({
          next: () => this.onSaved($localize`:@@admin.products.toast.updated:Produit mis à jour.`),
          error: err => this.onError(err),
        });
    } else {
      this.admin
        .createProduct({
          name: v.name,
          description: v.description,
          price: v.price,
          stockQuantity: v.stock,
          categoryId: v.categoryId,
          ...dims,
        })
        .subscribe({
          next: () => this.onSaved($localize`:@@admin.products.toast.created:Produit créé.`),
          error: err => this.onError(err),
        });
    }
  }

  /** Normalise une valeur de champ dimension : vide / NaN → null, sinon le nombre. */
  private toDimension(value: number | null): number | null {
    return value === null || Number.isNaN(value) ? null : value;
  }

  private onSaved(message: string): void {
    this.saving.set(false);
    this.toast.show(message, 'success');
    this.startCreate();
    this.loadProducts();
  }

  private onError(err: { error?: { detail?: string } }): void {
    this.saving.set(false);
    this.formError.set(
      err.error?.detail ??
        $localize`:@@admin.products.toast.saveError:Une erreur est survenue. Veuillez réessayer.`,
    );
  }

  protected askDelete(id: string): void {
    this.pendingDeleteId.set(id);
  }

  protected cancelDelete(): void {
    this.pendingDeleteId.set(null);
  }

  protected confirmDelete(): void {
    const id = this.pendingDeleteId();
    if (!id) {
      return;
    }
    this.admin.deleteProduct(id).subscribe({
      next: () => {
        this.pendingDeleteId.set(null);
        this.toast.show($localize`:@@admin.products.toast.deleted:Produit supprimé.`, 'success');
        if (this.editingId() === id) {
          this.startCreate();
        }
        this.loadProducts();
      },
      error: () => {
        this.pendingDeleteId.set(null);
        this.toast.show(
          $localize`:@@admin.products.toast.deleteError:La suppression a échoué.`,
          'error',
        );
      },
    });
  }

  protected productName(id: string | null): string {
    return this.items().find(p => p.id === id)?.name ?? '';
  }
}
