import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ExpenseDto, SaveExpenseRequest } from '../../core/api/api.models';

@Component({
  selector: 'app-expense-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './expense-form.component.html',
  styleUrl: './expense-form.component.scss',
})
export class ExpenseFormComponent {
  readonly year = input.required<number>();
  readonly month = input.required<number>();
  readonly expense = input<ExpenseDto | null>(null);
  readonly saving = input(false);
  readonly saved = output<SaveExpenseRequest>();
  readonly cancelled = output<void>();
  private readonly fb = inject(FormBuilder);
  readonly form = this.fb.nonNullable.group({
    date: ['', Validators.required],
    description: ['', [Validators.required, Validators.maxLength(50)]],
    amount: [0, [Validators.required, Validators.min(0.01), Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    store: ['', [Validators.required, Validators.maxLength(200)]],
    street: ['', [Validators.required, Validators.maxLength(200)]],
    postalCode: ['', [Validators.required, Validators.maxLength(20)]],
    city: ['', [Validators.required, Validators.maxLength(100)]],
  });

  constructor() {
    effect(() => {
      const value = this.expense();
      if (value) {
        this.form.reset({ date: value.date, description: value.description, amount: value.amount,
          store: value.store, street: value.street, postalCode: value.postalCode, city: value.city });
      } else {
        const year = this.year();
        const month = this.month();
        const date = `${year}-${String(month).padStart(2, '0')}-01`;
        this.form.reset({ date, description: '', amount: 0, store: '', street: '', postalCode: '', city: '' });
      }
    });
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.saving() || this.form.invalid) return;
    const data = this.form.getRawValue();
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data.date);
    if (!parts || Number(parts[1]) !== this.year() || Number(parts[2]) !== this.month()) {
      this.form.controls.date.setErrors({ reportMonth: true });
      return;
    }
    const date = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
    if (date.getFullYear() !== Number(parts[1]) || date.getMonth() + 1 !== Number(parts[2]) || date.getDate() !== Number(parts[3])) {
      this.form.controls.date.setErrors({ invalidDate: true });
      return;
    }
    this.saved.emit({ ...data, amount: Number(data.amount), description: data.description.trim(),
      store: data.store.trim(), street: data.street.trim(), postalCode: data.postalCode.trim(), city: data.city.trim() });
  }
}
