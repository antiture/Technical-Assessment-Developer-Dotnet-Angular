import { TestBed } from '@angular/core/testing';
import { ExpenseFormComponent } from './expense-form.component';

describe('ExpenseFormComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ExpenseFormComponent] }).compileComponents();
  });

  function setup() {
    const fixture = TestBed.createComponent(ExpenseFormComponent);
    fixture.componentRef.setInput('year', 2026);
    fixture.componentRef.setInput('month', 10);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.setValue({
      date: '2026-10-15', description: 'Restaurant', amount: 24.50,
      store: 'Café', street: '1 rue A', postalCode: '75020', city: 'Paris',
    });
    const saved = vi.fn();
    component.saved.subscribe(saved);
    return { component, saved };
  }

  it('emits a valid expense request', () => {
    const { component, saved } = setup();
    component.submit();
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-10-15', description: 'Restaurant', amount: 24.5 }));
  });

  it('rejects a date outside the report month', () => {
    const { component, saved } = setup();
    component.form.controls.date.setValue('2026-11-01');
    component.submit();
    expect(saved).not.toHaveBeenCalled();
  });

  it('rejects nonpositive amounts and overly long descriptions', () => {
    const { component, saved } = setup();
    component.form.patchValue({ amount: -1, description: 'X'.repeat(51) });
    component.submit();
    expect(saved).not.toHaveBeenCalled();
  });
});
