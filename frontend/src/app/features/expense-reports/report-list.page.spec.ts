import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ReportListPage } from './report-list.page';

const report = { id: 'r1', userId: 'u1', year: 2025, month: 10, title: 'Ada - Octobre 2025' };
const user = { id: 'u1', name: 'Ada' };
const inactive = { id: 'u2', name: 'Bob' };
const details = (active: boolean) => ({ firstName: 'Ada', lastName: 'A', postalAddress: '', monthlyExpenseLimit: 10, isActive: active });

describe('ReportListPage', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<ReportListPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportListPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ReportListPage);
    fixture.detectChanges();
    http.expectOne('/api/expense-reports').flush([report]);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('renders the backend-generated title and a Consulter action', () => {
    expect(fixture.nativeElement.textContent).toContain(report.title);
    expect(fixture.nativeElement.querySelector('.actions-cell button.link')?.textContent).toContain('Consulter');
  });

  it('opens a modal and loads the report by ID', () => {
    fixture.componentInstance.openDetail(report);
    expect(fixture.nativeElement.querySelector('dialog[aria-labelledby="detail-report-title"]')?.open).toBe(true);
    const request = http.expectOne('/api/expense-reports/r1');
    expect(request.request.method).toBe('GET');
    request.flush(report);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.report-details')?.textContent).toContain(report.title);
    fixture.componentInstance.closeDetail();
    expect(fixture.nativeElement.querySelector('dialog[aria-labelledby="detail-report-title"]')?.open).toBe(false);
  });

  it('shows fetch failure inside the detail modal', () => {
    fixture.componentInstance.openDetail(report);
    http.expectOne('/api/expense-reports/r1').flush({ error: 'Introuvable' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog[aria-labelledby="detail-report-title"] [role="alert"]')?.textContent).toContain('Introuvable');
    fixture.componentInstance.closeDetail();
  });

  it('ignores a late detail response after closing the modal', () => {
    fixture.componentInstance.openDetail(report);
    const request = http.expectOne('/api/expense-reports/r1');
    fixture.componentInstance.closeDetail();
    request.flush({ ...report, title: 'Late report' });
    expect(fixture.componentInstance.viewingReport()).toBeNull();
  });

  it('filters inactive users before creation', () => {
    fixture.componentInstance.openCreate();
    http.expectOne('/api/users').flush([user, inactive]);
    http.expectOne('/api/users/u1').flush(details(true));
    http.expectOne('/api/users/u2').flush(details(false));
    expect(fixture.componentInstance.eligibleUsers()).toEqual([user]);
  });

  it('shows conflict error inside the create dialog', () => {
    fixture.componentInstance.openCreate();
    http.expectOne('/api/users').flush([user]);
    http.expectOne('/api/users/u1').flush(details(true));
    fixture.componentInstance.create({ userId: 'u1', year: 2025, month: 10 });
    http.expectOne('/api/expense-reports').flush({ error: 'A report already exists.' }, { status: 409, statusText: 'Conflict' });
    expect(fixture.componentInstance.formError()).toBe('A report already exists.');
    expect(fixture.componentInstance.createOpen()).toBe(true);
  });

  it('refreshes reports after successful creation', () => {
    fixture.componentInstance.openCreate();
    http.expectOne('/api/users').flush([user]);
    http.expectOne('/api/users/u1').flush(details(true));
    fixture.componentInstance.create({ userId: 'u1', year: 2025, month: 11 });
    http.expectOne('/api/expense-reports').flush({ ...report, id: 'r2', month: 11 });
    http.expectOne('/api/expense-reports').flush([report, { ...report, id: 'r2', month: 11 }]);
    expect(fixture.componentInstance.reports()).toHaveLength(2);
  });

  it('does not delete until confirmation; refreshes after deletion', () => {
    fixture.componentInstance.requestDelete(report);
    expect(http.match('/api/expense-reports/r1')).toHaveLength(0);
    fixture.componentInstance.confirmDelete();
    const req = http.expectOne('/api/expense-reports/r1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    http.expectOne('/api/expense-reports').flush([]);
    expect(fixture.componentInstance.reports()).toEqual([]);
  });
});
