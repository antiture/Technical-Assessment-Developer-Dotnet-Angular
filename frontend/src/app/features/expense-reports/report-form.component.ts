import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CreateReportRequest, SaveExpenseRequest, UserInfo } from '../../core/api/api.models';
import { ExpenseFormComponent } from '../expenses/expense-form.component';

@Component({
  selector: 'app-report-form',
  standalone: true,
  imports: [ReactiveFormsModule, ExpenseFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './report-form.component.html',
  styleUrl: './report-form.component.scss',
})
export class ReportFormComponent {
  readonly eligibleUsers = input.required<UserInfo[]>();
  readonly saving = input(false);
  readonly saved = output<CreateReportRequest & { firstExpense?: SaveExpenseRequest }>();
  readonly includeExpense = signal(false);
  readonly firstExpense = signal<SaveExpenseRequest | null>(null);
  readonly cancelled = output<void>();
  private readonly fb = inject(FormBuilder);
  readonly months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août',
    'Septembre', 'Octobre', 'Novembre', 'Décembre',
  ];
  readonly form = this.fb.nonNullable.group({
    userId: ['', Validators.required],
    year: [new Date().getFullYear(), [Validators.required, Validators.min(1), Validators.max(9999)]],
    month: [new Date().getMonth() + 1, [Validators.required, Validators.min(1), Validators.max(12)]],
  });

  onFirstExpense(value: SaveExpenseRequest): void {
    this.firstExpense.set(value);
    this.submit();
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    const value = this.form.getRawValue();
    // The list may have refreshed while the dialog remained open.
    if (!this.eligibleUsers().some(user => user.id === value.userId)) return;
    if (this.includeExpense() && !this.firstExpense()) return;
    this.saved.emit({ userId: value.userId, year: Number(value.year), month: Number(value.month),
      ...(this.includeExpense() && this.firstExpense() ? { firstExpense: this.firstExpense() as SaveExpenseRequest } : {}) });
  }
}
