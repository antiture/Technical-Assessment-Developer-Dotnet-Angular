import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  standalone: true,
  template: `<h1>Notes de frais</h1><p>Liste et création des notes de frais — implémentation prévue au commit 04.</p>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPlaceholderPage {}
