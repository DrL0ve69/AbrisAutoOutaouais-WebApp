import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ProductDto } from '../../../core/models/product.model';
import { CartService } from '../../../core/services/cart.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-product-detail',
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, RouterLink, NgOptimizedImage],
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
