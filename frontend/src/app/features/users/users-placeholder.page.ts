import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  standalone: true,
  template: `<h1>Utilisateurs</h1><p>Gestion des utilisateurs — implémentation prévue aux commits 02 et 03.</p>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersPlaceholderPage {}
