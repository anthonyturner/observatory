import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Home · Observatory',
    loadComponent: () => import('./features/home/home-page/home-page').then((m) => m.HomePage),
  },
  {
    path: 'orrery',
    title: 'Orrery · Observatory',
    loadComponent: () =>
      import('./features/orrery/orrery-page/orrery-page').then((m) => m.OrreryPage),
  },
  {
    path: 'p/:owner/:repo',
    title: 'Review Queue · Observatory',
    loadComponent: () =>
      import('./features/queue/review-queue-page/review-queue-page').then((m) => m.ReviewQueuePage),
  },
  { path: '**', redirectTo: '' },
];
