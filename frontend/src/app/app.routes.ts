import { Routes } from '@angular/router';

export const appRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'expense-reports' },
  {
    path: 'users',
    loadComponent: () => import('./features/users/users-placeholder.page').then(m => m.UsersPlaceholderPage),
  },
  {
    path: 'expense-reports',
    pathMatch: 'full',
    loadComponent: () => import('./features/expense-reports/reports-placeholder.page').then(m => m.ReportsPlaceholderPage),
  },
  {
    path: 'expense-reports/:id',
    loadComponent: () => import('./features/expense-reports/report-detail-placeholder.page').then(m => m.ReportDetailPlaceholderPage),
  },
  { path: '**', redirectTo: 'expense-reports' },
];
