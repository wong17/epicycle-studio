import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'studio/2d',
    loadComponent: () => import('./features/studio/studio-shell').then((m) => m.StudioShell),
    data: { dimension: 2 },
  },
  {
    path: 'studio/3d',
    loadComponent: () => import('./features/studio/studio-shell').then((m) => m.StudioShell),
    data: { dimension: 3 },
  },
  {
    path: 'learn',
    loadComponent: () => import('./features/learn/learn-page').then((m) => m.LearnPage),
  },
  { path: '', redirectTo: 'studio/2d', pathMatch: 'full' },
  { path: '**', redirectTo: 'studio/2d' },
];
