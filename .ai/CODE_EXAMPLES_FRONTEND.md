# CODE_EXAMPLES_FRONTEND.md — AbrisTempo Local

Exemples de code Angular 21 copiables-collables.
Tous suivent les conventions du CLAUDE.md : signals, standalone, OnPush, inject(), reactive forms.

> Le client Angular vit dans `src/AbrisAutoOutaouais-WebApp.Client/` (projet `AbrisAutoOutaouais-WebApp.Client.esproj`).
> Tous les chemins ci-dessous sont relatifs à `src/AbrisAutoOutaouais-WebApp.Client/src/app/`.
>
> Les composants suivent la nouvelle convention de nommage Angular sans suffixe `.component`
> (ex. `home.ts` / `home.html` / `home.scss`). Quelques composants conservent encore le
> suffixe `.component.ts` (ex. `register.component.ts`, les composants a11y) — se référer à
> l'arborescence réelle.

---

## Modèles TypeScript (`core/models/`)

### `core/models/product.model.ts`

```typescript
// DTOs côté frontend — interfaces strictes (pas d'any)

export interface ProductSummaryDto {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly price: number;
  readonly rentalPrice: number | null;
  readonly isAvailable: boolean;
  readonly categoryName: string;
  readonly thumbnailUrl: string | null;
}

export interface ProductDto extends ProductSummaryDto {
  readonly description: string | null;
  readonly stock: number;
  readonly imageUrls: readonly string[];
}

export interface PaginatedList<T> {
  readonly items: readonly T[];
  readonly totalCount: number;
  readonly pageNumber: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

export interface CreateProductRequest {
  name: string;
  slug: string;
  price: number;
  stock: number;
  categoryId: string;
  description?: string;
  rentalPrice?: number;
}
```

---

### `core/models/booking.model.ts`

```typescript
export type BookingType   = 'Installation' | 'Livraison';
export type BookingStatus = 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled';

export interface BookingSlotDto {
  readonly id: string;
  readonly slotStart: string;   // ISO 8601
  readonly durationMin: number;
  readonly type: BookingType;
  readonly status: BookingStatus;
  readonly address: AddressDto;
  readonly notes: string | null;
}

export interface AddressDto {
  readonly street: string;
  readonly city: string;
  readonly province: string;
  readonly postalCode: string;
}

export interface CreateBookingRequest {
  slotStart: string;       // ISO 8601
  durationMin: number;
  type: BookingType;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  orderId?: string;
  notes?: string;
}

export interface AvailableSlot {
  readonly start: string;   // ISO 8601
  readonly end: string;
}
```

---

## Services (`core/services/`)

### `core/services/auth.service.ts`

```typescript
import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly roles: readonly string[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
  expiresAt: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http     = inject(HttpClient);
  private readonly router   = inject(Router);
  private readonly platform = inject(PLATFORM_ID);

  // État réactif — signals privés, computed publics
  private readonly _token = signal<string | null>(this.loadFromStorage('auth_token'));
  private readonly _user  = signal<AuthUser | null>(this.loadUserFromStorage());

  readonly token           = this._token.asReadonly();
  readonly user            = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._token() !== null);
  readonly isAdmin         = computed(() => this._user()?.roles.includes('Admin') ?? false);
  readonly isStaff         = computed(() => this._user()?.roles.some(r =>
    r === 'Staff' || r === 'Admin') ?? false);
  readonly fullName        = computed(() => {
    const u = this._user();
    return u ? `${u.firstName} ${u.lastName}` : null;
  });

  login(req: LoginRequest) {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, req).pipe(
      tap(res => this.setSession(res))
    );
  }

  register(req: RegisterRequest) {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/register`, req).pipe(
      tap(res => this.setSession(res))
    );
  }

  logout(): void {
    this.clearSession();
    this.router.navigateByUrl('/auth/login');
  }

  getToken(): string | null {
    return this._token();
  }

  private setSession(res: AuthResponse): void {
    this._token.set(res.token);
    this._user.set(res.user);

    if (isPlatformBrowser(this.platform)) {
      localStorage.setItem('auth_token', res.token);
      localStorage.setItem('auth_user', JSON.stringify(res.user));
    }
  }

  private clearSession(): void {
    this._token.set(null);
    this._user.set(null);

    if (isPlatformBrowser(this.platform)) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    }
  }

  private loadFromStorage(key: string): string | null {
    if (!isPlatformBrowser(this.platform)) return null;
    return localStorage.getItem(key);
  }

  private loadUserFromStorage(): AuthUser | null {
    if (!isPlatformBrowser(this.platform)) return null;
    const raw = localStorage.getItem('auth_user');
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  }
}
```

---

### `core/services/cart.service.ts`

```typescript
import { Injectable, computed, signal } from '@angular/core';
import { ProductSummaryDto } from '../models/product.model';

export interface CartItem {
  readonly product: ProductSummaryDto;
  quantity: number;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly _items = signal<CartItem[]>([]);

  readonly items     = this._items.asReadonly();
  readonly count     = computed(() => this._items().reduce((s, i) => s + i.quantity, 0));
  readonly subtotal  = computed(() =>
    this._items().reduce((s, i) => s + i.product.price * i.quantity, 0));

  addItem(product: ProductSummaryDto, qty = 1): void {
    this._items.update(items => {
      const existing = items.find(i => i.product.id === product.id);
      if (existing) {
        return items.map(i =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + qty }
            : i);
      }
      return [...items, { product, quantity: qty }];
    });
  }

  removeItem(productId: string): void {
    this._items.update(items => items.filter(i => i.product.id !== productId));
  }

  updateQuantity(productId: string, qty: number): void {
    if (qty <= 0) { this.removeItem(productId); return; }
    this._items.update(items =>
      items.map(i => i.product.id === productId ? { ...i, quantity: qty } : i));
  }

  clear(): void {
    this._items.set([]);
  }
}
```

---

## Interceptors (`core/interceptors/`)

### `core/interceptors/auth.interceptor.ts`

```typescript
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth  = inject(AuthService);
  const token = auth.getToken();

  if (!token) return next(req);

  return next(req.clone({
    setHeaders: { Authorization: `Bearer ${token}` }
  }));
};
```

---

### `core/interceptors/error.interceptor.ts`

```typescript
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        auth.logout();                    // Nettoie la session
        router.navigateByUrl('/auth/login');
      }
      return throwError(() => err);
    })
  );
};
```

---

## Guards (`core/guards/`)

### `core/guards/auth.guard.ts`

```typescript
import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  return auth.isAuthenticated()
    ? true
    : router.createUrlTree(['/auth/login']);
};
```

---

## Configuration (`app.config.ts`)

```typescript
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http';
import { provideClientHydration } from '@angular/platform-browser';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(
      withFetch(),                          // Fetch API (meilleure perfo SSR)
      withInterceptors([authInterceptor, errorInterceptor])
    ),
    provideClientHydration(),              // SSR hydration
  ],
};
```

---

## Routes (`app.routes.ts`)

État réel : seules les routes `''` (home), `auth`, `mon-compte` (account) et `me` sont actives.
Les routes `shop` / `rental` / `installation` / `admin` ne sont pas encore implémentées (voir
section « Cible / à venir » plus bas).

```typescript
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { publicGuard } from './core/guards/public.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then(m => m.HomeComponent),
    title: 'AbrisTempo Local — Accueil',
  },
  // Redirections des anciens chemins
  { path: 'login', redirectTo: '/auth', pathMatch: 'full' },
  { path: 'register', redirectTo: '/auth', pathMatch: 'full' },
  {
    path: 'me',
    loadComponent: () => import('./features/auth/me/profile').then(m => m.ProfileComponent),
    canActivate: [authGuard],
    title: 'AbrisTempo Local — Mon Compte',
  },
  {
    path: 'auth',
    canActivate: [publicGuard],          // Bloque si déjà connecté
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },
  {
    path: 'mon-compte',
    canActivate: [authGuard],
    loadChildren: () => import('./features/account/account.routes').then(m => m.ACCOUNT_ROUTES),
  },
  { path: '**', redirectTo: '' },
];
```

> **Cible / à venir (non implémenté)** — `shop`, `rental`, `installation` (booking) et `admin`
> sont prévus mais leurs dossiers `features/` n'existent pas encore. Lorsqu'ils seront ajoutés,
> ils suivront le même schéma `loadChildren` lazy + guards (`adminGuard` pour `admin`).

---

## Composants

> Les exemples `product-detail` et `booking-form` ci-dessous concernent des features
> **Cible / à venir (non implémenté)** — ils illustrent les conventions attendues mais les
> dossiers `features/shop/` et `features/booking/` n'existent pas encore. Le composant `login`
> et `product-card` plus bas, eux, existent réellement.

### `features/shop/product-detail/product-detail.ts` _(à venir)_

```typescript
import {
  ChangeDetectionStrategy, Component, computed, inject, input, signal, OnInit
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { CartService } from '../../../core/services/cart.service';
import { environment } from '../../../../environments/environment';
import { ProductDto } from '../../../core/models/product.model';

@Component({
  selector: 'app-product-detail',
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, NgOptimizedImage],
})
export class ProductDetailComponent implements OnInit {
  // input() signal — Angular 21 (pas de @Input)
  readonly slug = input.required<string>();

  private readonly http   = inject(HttpClient);
  private readonly cart   = inject(CartService);
  private readonly router = inject(Router);

  // État local avec signals
  protected readonly product  = signal<ProductDto | null>(null);
  protected readonly loading  = signal(true);
  protected readonly error    = signal<string | null>(null);
  protected readonly quantity = signal(1);
  protected readonly added    = signal(false);

  // Computed — état dérivé (jamais de logique dans le template)
  protected readonly canAddToCart = computed(() =>
    (this.product()?.isAvailable ?? false) && this.quantity() > 0);

  protected readonly totalPrice = computed(() => {
    const p = this.product();
    return p ? p.price * this.quantity() : 0;
  });

  ngOnInit(): void {
    this.http.get<ProductDto>(
      `${environment.apiUrl}/products/${this.slug()}`
    ).subscribe({
      next:  p  => { this.product.set(p); this.loading.set(false); },
      error: () => { this.error.set('Produit introuvable.'); this.loading.set(false); },
    });
  }

  protected addToCart(): void {
    const p = this.product();
    if (!p || !this.canAddToCart()) return;

    this.cart.addItem(p, this.quantity());
    this.added.set(true);
    setTimeout(() => this.added.set(false), 2000);
  }

  protected changeQuantity(delta: number): void {
    this.quantity.update(q => Math.max(1, q + delta));
  }
}
```

---

### `features/booking/booking-form/booking-form.ts` _(à venir)_

```typescript
import {
  ChangeDetectionStrategy, Component, computed, inject, signal
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AvailableSlot, BookingType, CreateBookingRequest } from '../../../core/models/booking.model';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-booking-form',
  templateUrl: './booking-form.html',
  styleUrl: './booking-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DatePipe],
})
export class BookingFormComponent {
  private readonly fb     = inject(FormBuilder);
  private readonly http   = inject(HttpClient);
  private readonly router = inject(Router);

  protected readonly slots    = signal<AvailableSlot[]>([]);
  protected readonly loading  = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error    = signal<string | null>(null);

  // Formulaire réactif typé
  protected readonly form = this.fb.nonNullable.group({
    type:       ['Installation' as BookingType, Validators.required],
    slotStart:  ['', Validators.required],
    street:     ['', [Validators.required, Validators.maxLength(200)]],
    city:       ['', [Validators.required, Validators.maxLength(100)]],
    province:   ['QC', [Validators.required, Validators.maxLength(2)]],
    postalCode: ['', [Validators.required, Validators.pattern(/^[A-Z]\d[A-Z]\d[A-Z]\d$/)]],
    notes:      [''],
  });

  protected readonly isValid = computed(() => this.form.valid);

  protected loadSlots(): void {
    this.loading.set(true);
    this.http.get<AvailableSlot[]>(`${environment.apiUrl}/bookings/available-slots`)
      .subscribe({
        next:  slots => { this.slots.set(slots); this.loading.set(false); },
        error: ()    => { this.error.set('Impossible de charger les créneaux.'); this.loading.set(false); },
      });
  }

  protected submit(): void {
    if (!this.form.valid) return;

    this.submitting.set(true);
    const val  = this.form.getRawValue();
    const body: CreateBookingRequest = {
      ...val,
      durationMin: 120,   // 2h par défaut pour installation
    };

    this.http.post<{ id: string }>(`${environment.apiUrl}/bookings`, body)
      .subscribe({
        next:  res => this.router.navigate(['/account/my-bookings', res.id]),
        error: err => {
          this.error.set(err.error?.detail ?? 'Une erreur est survenue.');
          this.submitting.set(false);
        },
      });
  }
}
```

---

### `features/auth/login/login.ts`

```typescript
import {
  ChangeDetectionStrategy, Component, inject, signal
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
})
export class LoginComponent {
  private readonly fb     = inject(FormBuilder);
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error   = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected submit(): void {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set(null);

    this.auth.login(this.form.getRawValue()).subscribe({
      next:  () => this.router.navigateByUrl('/'),
      error: err => {
        this.error.set(err.error?.detail ?? 'Identifiants incorrects.');
        this.loading.set(false);
      },
    });
  }
}
```

---

### `shared/components/product-card/product-card.ts`

```typescript
import {
  ChangeDetectionStrategy, Component, input, output, computed
} from '@angular/core';
import { CurrencyPipe, NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductSummaryDto } from '../../../core/models/product.model';

@Component({
  selector: 'app-product-card',
  templateUrl: './product-card.html',
  styleUrl: './product-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, NgOptimizedImage, RouterLink],
})
export class ProductCardComponent {
  // input() — Angular 21 (pas de @Input())
  readonly product   = input.required<ProductSummaryDto>();
  readonly showRent  = input(false);

  // output() — Angular 21 (pas de @Output())
  readonly addToCart = output<ProductSummaryDto>();

  protected readonly hasRental = computed(() =>
    this.showRent() && this.product().rentalPrice !== null);

  protected onAddToCart(): void {
    this.addToCart.emit(this.product());
  }
}
```

---

## Styles (`shared/styles/`)

### `shared/styles/_tokens.scss`

```scss
// Design tokens — AbrisTempo
// Importer globalement dans styles.scss : @use 'shared/styles/tokens' as *;

:root {
  // Couleurs de marque (inspirées du rouge Tempo + blanc)
  --color-primary:        #e52329;   // Rouge Tempo
  --color-primary-dark:   #c01e24;
  --color-primary-light:  #ff4a50;
  --color-secondary:      #1a1a2e;   // Bleu nuit
  --color-accent:         #f5a623;   // Jaune chaud

  // Neutres
  --color-bg:             #ffffff;
  --color-bg-subtle:      #f8f8f8;
  --color-border:         #e0e0e0;
  --color-text:           #1a1a1a;
  --color-text-muted:     #666666;
  --color-text-inverse:   #ffffff;

  // Feedback
  --color-success:        #27ae60;
  --color-warning:        #f39c12;
  --color-error:          #e74c3c;
  --color-info:           #2980b9;

  // Spacing (échelle 4px)
  --space-1:  0.25rem;   // 4px
  --space-2:  0.5rem;    // 8px
  --space-3:  0.75rem;   // 12px
  --space-4:  1rem;      // 16px
  --space-5:  1.25rem;   // 20px
  --space-6:  1.5rem;    // 24px
  --space-8:  2rem;      // 32px
  --space-10: 2.5rem;    // 40px
  --space-12: 3rem;      // 48px
  --space-16: 4rem;      // 64px
  --space-20: 5rem;      // 80px

  // Typographie
  --font-sans:  'Inter', system-ui, -apple-system, sans-serif;
  --font-size-sm:   0.875rem;  // 14px
  --font-size-base: 1rem;      // 16px
  --font-size-lg:   1.125rem;  // 18px
  --font-size-xl:   1.25rem;   // 20px
  --font-size-2xl:  1.5rem;    // 24px
  --font-size-3xl:  1.875rem;  // 30px
  --font-size-4xl:  2.25rem;   // 36px

  // Radius
  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:   12px;
  --radius-full: 9999px;

  // Shadows
  --shadow-sm:  0 1px 3px rgba(0,0,0,.1);
  --shadow-md:  0 4px 12px rgba(0,0,0,.12);
  --shadow-lg:  0 8px 24px rgba(0,0,0,.15);

  // Transitions
  --transition-fast: 150ms ease;
  --transition-base: 250ms ease;
}

// Dark mode automatique
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg:         #0f0f1a;
    --color-bg-subtle:  #1a1a2e;
    --color-border:     #2d2d4e;
    --color-text:       #e8e8f0;
    --color-text-muted: #9999bb;
  }
}
```

---

### `shared/styles/_breakpoints.scss`

```scss
// Breakpoints — mobile-first
@mixin sm  { @media (min-width: 640px)  { @content; } }
@mixin md  { @media (min-width: 768px)  { @content; } }
@mixin lg  { @media (min-width: 1024px) { @content; } }
@mixin xl  { @media (min-width: 1280px) { @content; } }
@mixin xxl { @media (min-width: 1536px) { @content; } }
```

---

## Environnement (`environments/`)

### `environments/environment.ts`

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000/api/v1',
} as const;
```

### `environments/environment.prod.ts`

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://api.abristempo.com/api/v1',   // Remplacer par l'URL de production
} as const;
```
