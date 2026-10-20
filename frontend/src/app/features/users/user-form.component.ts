import { ChangeDetectionStrategy, Component, input, output, effect, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SaveUserRequest, UserDetails } from '../../core/api/api.models';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-form.component.html',
  styleUrl: './user-form.component.scss',
})
export class UserFormComponent {
  readonly user = input<UserDetails | null>(null);
  readonly saving = input(false);
  readonly saved = output<SaveUserRequest>();
  readonly cancelled = output<void>();
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(/.*\S.*/)]],
    lastName: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(/.*\S.*/)]],
    postalAddress: ['', Validators.maxLength(500)],
    monthlyExpenseLimit: [10, [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/)]],
  });

  constructor() {
    effect(() => {
      const user = this.user();
      this.form.reset(user ? {
        firstName: user.firstName,
        lastName: user.lastName,
        postalAddress: user.postalAddress,
        monthlyExpenseLimit: user.monthlyExpenseLimit,
      } : { firstName: '', lastName: '', postalAddress: '', monthlyExpenseLimit: 10 });
    });
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    const values = this.form.getRawValue();
    this.saved.emit({
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      postalAddress: values.postalAddress.trim(),
      monthlyExpenseLimit: values.monthlyExpenseLimit,
      isActive: this.user()?.isActive ?? true,
    });
  }
}
