# Stable Users ordering overlay

Applies on top of `N2JSoft_UsersPagination_Overlay.zip`. Changes only `user-list.page.ts` and `user-list.page.spec.ts`.

Ordering: Name ASC (French locale, case/accent insensitive), then Id ASC. Sort precedes pagination. State refresh preserves order unless user name changes.

Run in `frontend`:

```bat
npm test -- --run
npx nx build n2f --skip-nx-cache
npx nx lint n2f
```

Commit: `fix(users): enforce stable name and id ordering`.
