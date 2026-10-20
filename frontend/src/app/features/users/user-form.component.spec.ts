import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserFormComponent } from './user-form.component';
import { UserDetails } from '../../core/api/api.models';

describe('UserFormComponent', () => {
  let fixture: ComponentFixture<UserFormComponent>;
  const user: UserDetails = {
    id: 'user-1', firstName: 'Ada', lastName: 'Lovelace', postalAddress: 'Paris',
    monthlyExpenseLimit: 5, isActive: false,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [UserFormComponent] }).compileComponents();
    fixture = TestBed.createComponent(UserFormComponent);
    fixture.detectChanges();
  });

  it('rejects an empty name and negative limit', () => {
    const component = fixture.componentInstance;
    const emit = vi.spyOn(component.saved, 'emit');
    component.form.setValue({ firstName: '', lastName: 'Smith', postalAddress: '', monthlyExpenseLimit: -1 });
    component.submit();
    expect(component.form.invalid).toBe(true);
    expect(emit).not.toHaveBeenCalled();
  });

  it('creates an active user with trimmed fields and zero limit', () => {
    const component = fixture.componentInstance;
    const emit = vi.spyOn(component.saved, 'emit');
    component.form.setValue({ firstName: ' Ada ', lastName: ' Lee ', postalAddress: ' Home ', monthlyExpenseLimit: 0 });
    component.submit();
    expect(emit).toHaveBeenCalledWith({
      firstName: 'Ada', lastName: 'Lee', postalAddress: 'Home', monthlyExpenseLimit: 0, isActive: true,
    });
  });

  it('prefills user details and preserves inactive status when editing', () => {
    fixture.componentRef.setInput('user', user);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.form.controls.firstName.value).toBe('Ada');
    const emit = vi.spyOn(component.saved, 'emit');
    component.submit();
    expect(emit).toHaveBeenCalledWith({
      firstName: 'Ada', lastName: 'Lovelace', postalAddress: 'Paris', monthlyExpenseLimit: 5, isActive: false,
    });
  });

  it('rejects fractions and whitespace-only names', () => {
    const component = fixture.componentInstance;
    component.form.setValue({ firstName: '  ', lastName: 'Lee', postalAddress: '', monthlyExpenseLimit: 2.5 });
    expect(component.form.invalid).toBe(true);
  });
});
