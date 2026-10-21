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

  it('paginates report listings five at a time, without affecting expense pagination', () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ ...report, id: `r${i + 1}`, title: `Note ${i + 1}` }));
    fixture.componentInstance.reports.set(six);
    fixture.detectChanges();

    const visible = () => Array.from(fixture.nativeElement.querySelectorAll('.panel tbody tr'));
    expect(visible()).toHaveLength(5);
    expect(fixture.nativeElement.textContent).toContain('Page 1 / 2');
    expect(visible()[0].textContent).toContain('Note 1');
    fixture.componentInstance.changeReportPage(2);
    fixture.detectChanges();
    expect(visible()).toHaveLength(1);
    expect(visible()[0].textContent).toContain('Note 6');
    fixture.componentInstance.changeReportPage(3);
    expect(fixture.componentInstance.reportPage()).toBe(2);
  });

  it('clamps the report page when a refreshed list loses its final page', () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ ...report, id: `r${i + 1}` }));
    fixture.componentInstance.reports.set(six);
    fixture.componentInstance.changeReportPage(2);
    fixture.componentInstance.loadReports();
    http.expectOne('/api/expense-reports').flush(six.slice(0, 5));
    fixture.detectChanges();
    expect(fixture.componentInstance.reportPage()).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('.panel tbody tr')).toHaveLength(5);
  });

  it('keeps a valid current page after refreshing the report list', () => {
    const eleven = Array.from({ length: 11 }, (_, i) => ({ ...report, id: `r${i + 1}` }));
    fixture.componentInstance.reports.set(eleven);
    fixture.componentInstance.changeReportPage(2);
    fixture.componentInstance.loadReports();
    http.expectOne('/api/expense-reports').flush(eleven.slice(0, 10));
    expect(fixture.componentInstance.reportPage()).toBe(2);
    expect(fixture.componentInstance.visibleReports()).toHaveLength(5);
  });

  it('opens a modal and loads the report by ID', () => {
    fixture.componentInstance.openDetail(report);
    expect(fixture.nativeElement.querySelector('dialog[aria-labelledby="detail-report-title"]')?.open).toBe(true);
    const request = http.expectOne('/api/expense-reports/r1');
    const expenses = http.expectOne(req => req.url === '/api/expense-reports/r1/expenses');
    expect(expenses.request.params.get('page')).toBe('1');
    expenses.flush({ page: 1, pageSize: 5, totalCount: 0, items: [] });
    expect(request.request.method).toBe('GET');
    request.flush(report);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.report-summary')?.textContent).toContain(report.title);
    fixture.componentInstance.closeDetail();
    expect(fixture.nativeElement.querySelector('dialog[aria-labelledby="detail-report-title"]')?.open).toBe(false);
  });

  it('shows fetch failure inside the detail modal', () => {
    fixture.componentInstance.openDetail(report);
    http.expectOne(req => req.url === '/api/expense-reports/r1/expenses').flush({ page: 1, pageSize: 5, totalCount: 0, items: [] });
    http.expectOne('/api/expense-reports/r1').flush({ error: 'Introuvable' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog[aria-labelledby="detail-report-title"] [role="alert"]')?.textContent).toContain('Introuvable');
    fixture.componentInstance.closeDetail();
  });

  it('ignores a late detail response after closing the modal', () => {
    fixture.componentInstance.openDetail(report);
    const request = http.expectOne('/api/expense-reports/r1');
    const expenses = http.expectOne(req => req.url === '/api/expense-reports/r1/expenses');
    fixture.componentInstance.closeDetail();
    expenses.flush({ page: 1, pageSize: 5, totalCount: 0, items: [] });
    request.flush({ ...report, title: 'Late report' });
    expect(fixture.componentInstance.viewingReport()).toBeNull();
  });

  it('shows expense descriptions and currency and pages five items at a time', () => {
    fixture.componentInstance.openDetail(report);
    http.expectOne('/api/expense-reports/r1').flush(report);
    const firstPage = http.expectOne(req => req.url === '/api/expense-reports/r1/expenses');
    expect(firstPage.request.params.get('pageSize')).toBe('5');
    firstPage.flush({ page: 1, pageSize: 5, totalCount: 6, items: [{
      id: 'e1', expenseReportId: 'r1', date: '2025-10-15', description: 'Train', amount: 24.5,
      store: 'SNCF', street: 'Rue A', postalCode: '75001', city: 'Paris',
    }] });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.expenses-table')?.textContent).toContain('Train');
    expect(fixture.nativeElement.querySelector('.expenses-table')?.textContent).toContain('24,50');
    fixture.componentInstance.changePage(2);
    const next = http.expectOne(req => req.url === '/api/expense-reports/r1/expenses');
    expect(next.request.params.get('page')).toBe('2');
    next.flush({ page: 2, pageSize: 5, totalCount: 6, items: [] });
    expect(fixture.componentInstance.currentPage()).toBe(2);
    fixture.componentInstance.closeDetail();
  });

  it('shows errors for expense requests without hiding the report', () => {
    fixture.componentInstance.openDetail(report);
    http.expectOne('/api/expense-reports/r1').flush(report);
    http.expectOne(req => req.url === '/api/expense-reports/r1/expenses')
      .flush({ error: 'Chargement impossible' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.expense-section [role="alert"]')?.textContent)
      .toContain('Chargement impossible');
    fixture.componentInstance.closeDetail();
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
