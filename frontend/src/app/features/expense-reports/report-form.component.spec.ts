import { TestBed } from '@angular/core/testing';
import { ReportFormComponent } from './report-form.component';

describe('ReportFormComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ReportFormComponent] }).compileComponents();
  });

  it('emits a report only with a valid active user and year/month', () => {
    const fixture = TestBed.createComponent(ReportFormComponent);
    fixture.componentRef.setInput('eligibleUsers', [{ id: 'u1', name: 'Ada' }]);
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.saved.subscribe(spy);
    fixture.componentInstance.form.setValue({ userId: 'u1', year: 2025, month: 10 });
    fixture.componentInstance.submit();
    expect(spy).toHaveBeenCalledWith({ userId: 'u1', year: 2025, month: 10 });
  });

  it('rejects users not in the active list', () => {
    const fixture = TestBed.createComponent(ReportFormComponent);
    fixture.componentRef.setInput('eligibleUsers', [{ id: 'u1', name: 'Ada' }]);
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.saved.subscribe(spy);
    fixture.componentInstance.form.setValue({ userId: 'inactive', year: 2025, month: 10 });
    fixture.componentInstance.submit();
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejects invalid year and month', () => {
    const fixture = TestBed.createComponent(ReportFormComponent);
    fixture.componentRef.setInput('eligibleUsers', [{ id: 'u1', name: 'Ada' }]);
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.saved.subscribe(spy);
    fixture.componentInstance.form.setValue({ userId: 'u1', year: 0, month: 13 });
    fixture.componentInstance.submit();
    expect(spy).not.toHaveBeenCalled();
  });
});
