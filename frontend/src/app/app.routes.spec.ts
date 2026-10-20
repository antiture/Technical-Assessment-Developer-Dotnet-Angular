import { appRoutes } from './app.routes';

describe('application routing', () => {
  it('redirects the root to expense-reports', () => {
    expect(appRoutes.find(route => route.path === '')).toMatchObject({
      redirectTo: 'expense-reports', pathMatch: 'full',
    });
  });

  it.each(['users', 'expense-reports', 'expense-reports/:id'])(
    'lazy-loads %s', async (path) => {
      const route = appRoutes.find(item => item.path === path);
      expect(route?.loadComponent).toBeTypeOf('function');
      const component = await route!.loadComponent!();
      expect(component).toBeTruthy();
    },
  );

  it('redirects unknown URLs', () => {
    expect(appRoutes.find(route => route.path === '**')?.redirectTo).toBe('expense-reports');
  });
});
