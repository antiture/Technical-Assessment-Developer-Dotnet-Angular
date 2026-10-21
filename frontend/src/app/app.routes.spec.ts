import { appRoutes } from './app.routes';

describe('application routing', () => {
  it('redirects the root to expense-reports', () => {
    expect(appRoutes.find(route => route.path === '')).toMatchObject({
      redirectTo: 'expense-reports', pathMatch: 'full',
    });
  });

  it.each(['users', 'expense-reports'])(
    'lazy-loads %s', async (path) => {
      const route = appRoutes.find(item => item.path === path);
      expect(route).toBeDefined();
      if (!route || typeof route.loadComponent !== 'function') {
        throw new Error(`Missing lazy-loaded route: ${path}`);
      }
      const component = await route.loadComponent();
      expect(component).toBeTruthy();
    },
  );

  it('does not expose an obsolete detail placeholder route', () => {
    expect(appRoutes.some(route => route.path === 'expense-reports/:id')).toBe(false);
  });

  it('redirects unknown URLs', () => {
    expect(appRoutes.find(route => route.path === '**')?.redirectTo).toBe('expense-reports');
  });
});
