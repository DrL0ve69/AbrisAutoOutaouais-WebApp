import {
  ChangeDetectionStrategy, Component, computed, input, output
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { ProductSummaryDto } from '../../../core/models/product.model';

@Component({
  selector: 'app-product-card',
  templateUrl: './product-card.html',
  styleUrl: './product-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, RouterLink, NgOptimizedImage],
})
export class ProductCardComponent {
  readonly product = input.required<ProductSummaryDto>();
  readonly showRent = input(false);

  readonly addToCart = output<ProductSummaryDto>();

  protected readonly hasRental = computed(
    () => this.showRent() && this.product().rentalPrice !== null
  );

  protected onAdd(): void {
    this.addToCart.emit(this.product());
  }
}
