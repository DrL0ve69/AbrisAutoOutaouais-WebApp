import {
  ChangeDetectionStrategy, Component, computed, input, output, signal
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductSummaryDto, resolveProductImage } from '../../../core/models/product.model';

@Component({
  selector: 'app-product-card',
  templateUrl: './product-card.html',
  styleUrl: './product-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, RouterLink],
})
export class ProductCardComponent {
  readonly product = input.required<ProductSummaryDto>();
  readonly showRent = input(false);

  readonly addToCart = output<ProductSummaryDto>();

  // Image SVG dérivée du slug (cf. resolveProductImage). On bascule sur le
  // placeholder emoji si le fichier est introuvable (événement (error)).
  protected readonly imageFailed = signal(false);
  protected readonly imageSrc = computed(() => resolveProductImage(this.product()));

  protected readonly hasRental = computed(
    () => this.showRent() && this.product().rentalPrice !== null
  );

  protected onImageError(): void {
    this.imageFailed.set(true);
  }

  protected onAdd(): void {
    this.addToCart.emit(this.product());
  }
}
