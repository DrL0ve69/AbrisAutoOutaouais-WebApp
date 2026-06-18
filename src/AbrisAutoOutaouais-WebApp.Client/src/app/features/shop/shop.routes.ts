import { Routes } from '@angular/router';

export const SHOP_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./catalog/catalog').then(m => m.CatalogComponent),
    title: 'AbrisTempo — Boutique',
  },
  // Catalogue PARAMÉTRIQUE (EPIC 9.3) : ces routes littérales DOIVENT précéder la route
  // catch-all `:slug` (détail produit) pour ne pas être interceptées par elle.
  {
    path: 'modeles/:category',
    loadComponent: () =>
      import('./shelter-models/shelter-models').then(m => m.ShelterModelsComponent),
    title: 'AbrisTempo — Configurer un abri',
  },
  {
    path: 'configurer/:slug',
    loadComponent: () =>
      import('./configure-shelter/configure-shelter').then(m => m.ConfigureShelterComponent),
    title: 'AbrisTempo — Configurateur',
  },
  {
    path: ':slug',
    loadComponent: () =>
      import('./product-detail/product-detail').then(m => m.ProductDetailComponent),
    title: 'AbrisTempo — Produit',
  },
  { path: '**', redirectTo: '' },
];
