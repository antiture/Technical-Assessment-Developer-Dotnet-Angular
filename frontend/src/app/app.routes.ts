import { Routes } from '@angular/router';

export const appRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'expense-reports' },
  {
    path: 'users',
    loadComponent: () => import('./features/users/user-list.page').then(m => m.UserListPage),
  },
  {
    path: 'expense-reports',
    pathMatch: 'full',
    loadComponent: () => import('./features/expense-reports/report-list.page').then(m => m.ReportListPage),
  },
  {
    path: 'expense-reports/:id',
    loadComponent: () => import('./features/expense-reports/report-detail-placeholder.page').then(m => m.ReportDetailPlaceholderPage),
  },
  { path: '**', redirectTo: 'expense-reports' },
];
