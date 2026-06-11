import { Routes } from '@angular/router';

export const SHOP_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./catalog/catalog').then(m => m.CatalogComponent),
    title: 'AbrisTempo — Boutique',
  },
  {
    path: ':slug',
    loadComponent: () =>
      import('./product-detail/product-detail').then(m => m.ProductDetailComponent),
    title: 'AbrisTempo — Produit',
  },
  { path: '**', redirectTo: '' },
];
