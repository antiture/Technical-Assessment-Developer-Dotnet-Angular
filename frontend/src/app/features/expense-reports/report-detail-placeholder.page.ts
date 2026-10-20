import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `<h1>Détail de la note de frais</h1><p>Consultation des dépenses — implémentation prévue aux commits 05 et 06.</p><a routerLink="/expense-reports">Retour aux notes de frais</a>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportDetailPlaceholderPage {}
