import { Routes } from '@angular/router';
import { GIT_CHEAT_SHEET_BOOK } from '../../core/guide/git-cheat-sheet-book';
import { GUIDE_BOOK } from '../../core/guide/guide-book';

/** The Git cheat sheet: the Guide's page, given the cheat sheet's text. */
export const GIT_CHEAT_SHEET_ROUTES: Routes = [
  {
    path: '',
    providers: [{ provide: GUIDE_BOOK, useValue: GIT_CHEAT_SHEET_BOOK }],
    loadComponent: () => import('./guide-page/guide-page').then((m) => m.GuidePage),
  },
];
