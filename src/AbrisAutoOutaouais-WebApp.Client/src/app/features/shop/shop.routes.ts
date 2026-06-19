import { Routes } from '@angular/router';

export const SHOP_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./catalog/catalog').then(m => m.CatalogComponent),
    title: 'AbrisTempo — Boutique',
  },
  // Rework EPIC 9 : la configuration des abris paramétriques se fait désormais via un overlay
  // (ouvert depuis une carte de modèle du catalogue) ou EN LIGNE sur la fiche détail — plus de
  // route dédiée `modeles/:category` ni `configurer/:slug`. La route `:slug` (détail) résout
  // d'abord un MODÈLE paramétrique, puis se rabat sur un produit fixe.
  {
    path: ':slug',
    loadComponent: () =>
      import('./product-detail/product-detail').then(m => m.ProductDetailComponent),
    title: 'AbrisTempo — Produit',
  },
  { path: '**', redirectTo: '' },
];
