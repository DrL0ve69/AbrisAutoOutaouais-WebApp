import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { RentalService } from '../../core/services/rental.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ProfileService } from '../../core/services/profile.service';
import { ProductSummaryDto } from '../../core/models/product.model';
import { CreateRentalContractRequest } from '../../core/models/rental.model';
import { FaqComponent } from '../../shared/components/faq/faq.component';
import { LOCATION_FAQ } from '../../shared/content/faq.data';
import { CIVIC_PATTERN, POSTAL_PATTERN, normalizePostal } from '../../core/validators/address.validators';

/**
 * Location saisonnière d'abris.
 * Liste les produits louables, laisse choisir un abri + une période + une adresse,
 * puis crée le contrat de location.
 */
@Component({
  selector: 'app-location',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, CurrencyPipe, FaqComponent],
  templateUrl: './location.html',
  styleUrl: './location.scss',
})
export class LocationComponent implements OnInit {
  /** Entrées FAQ de la page (durée, dépôt, annulation, installation). */
  protected readonly faq = LOCATION_FAQ;

  private readonly fb = inject(FormBuilder);
  private readonly products = inject(ProductService);
  private readonly rentals = inject(RentalService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly profile = inject(ProfileService);

  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly rentable = signal<readonly ProductSummaryDto[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly hasProducts = computed(() => this.rentable().length > 0);
  protected readonly selectedProduct = computed(
    () => this.rentable().find(p => p.id === this.selectedId()) ?? null,
  );

  protected readonly form = this.fb.nonNullable.group({
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    civicNumber: ['', [Validators.required, Validators.pattern(CIVIC_PATTERN)]],
    street: ['', Validators.required],
    apartment: ['', Validators.maxLength(20)],
    city: ['', Validators.required],
    province: ['QC', Validators.required],
    postalCode: ['', [Validators.required, Validators.pattern(POSTAL_PATTERN)]],
  });

  constructor() {
    // Pré-remplit l'adresse de location avec l'adresse par défaut enregistrée.
    this.profile.ensureLoaded();
    effect(() => this.profile.applyDefaultAddress(this.form));
  }

  protected get f() {
    return this.form.controls;
  }

  ngOnInit(): void {
    this.products.getProducts({ pageSize: 100 }).subscribe({
      next: page => {
        this.rentable.set((page.items ?? []).filter(p => p.rentalPrice != null));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected selectProduct(id: string): void {
    this.selectedId.set(id);
  }

  protected confirm(): void {
    if (this.submitting()) return;

    if (!this.auth.isAuthenticated()) {
      this.toast.show(
        $localize`:@@location.authRequired:Connectez-vous pour louer un abri.`,
        'info',
      );
      this.router.navigateByUrl('/auth');
      return;
    }

    const productId = this.selectedId();
    if (!productId) {
      this.toast.show(
        $localize`:@@location.noProduct:Veuillez choisir un abri à louer.`,
        'error',
      );
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    if (v.endDate <= v.startDate) {
      this.toast.show(
        $localize`:@@location.badDates:La date de fin doit être après la date de début.`,
        'error',
      );
      return;
    }

    this.submitting.set(true);
    const request: CreateRentalContractRequest = {
      productId,
      startDate: v.startDate,
      endDate: v.endDate,
      address: {
        civicNumber: v.civicNumber,
        street: v.street,
        apartment: v.apartment.trim() || null,
        city: v.city,
        province: v.province || 'QC',
        postalCode: normalizePostal(v.postalCode),
        country: 'Canada',
      },
    };

    this.rentals.createRental(request).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.show(
          $localize`:@@location.success:Location confirmée !`,
          'success',
        );
        this.router.navigateByUrl('/mon-compte/locations');
      },
      error: () => {
        this.submitting.set(false);
        this.toast.show(
          $localize`:@@location.error:La location a échoué. Veuillez réessayer.`,
          'error',
        );
      },
    });
  }
}
