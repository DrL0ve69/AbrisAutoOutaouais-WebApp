import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home.component').then(m => m.HomeComponent),
  },
  // {
  //   path: 'work',
  //   loadChildren: () =>
  //     import('./features/work/work.routes').then(m => m.WORK_ROUTES),
  // },
  // {
  //   path: 'projects',
  //   loadChildren: () =>
  //     import('./features/projects/projects.routes').then(m => m.PROJECTS_ROUTES),
  // },
  // {
  //   path: 'about',
  //   loadComponent: () =>
  //     import('./features/about/about.component').then(m => m.About),
  // },
  // {
  //   path: 'contact',
  //   loadComponent: () =>
  //     import('./features/contact/contact.component').then(m => m.Contact),
  // },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  // {
  //   path: 'admin',
  //   canActivate: [AuthGuard],
  //   data: { roles: ['Admin'] },
  //   loadChildren: () =>
  //     import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES),
  // },
  { path: '**', redirectTo: '' },
];
