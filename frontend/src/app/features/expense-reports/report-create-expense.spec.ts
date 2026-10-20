import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ReportListPage } from './report-list.page';

const report = { id: 'r1', userId: 'u1', year: 2026, month: 10, title: 'Ada - Octobre 2026' };
const firstExpense = { date: '2026-10-01', description: 'Train', amount: 24.50,
  store: 'SNCF', street: '1 rue A', postalCode: '75020', city: 'Paris' };

describe('Report creation with first expense', () => {
  let http: HttpTestingController;
  let page: ReportListPage;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportListPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ReportListPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne('/api/expense-reports').flush([]);
  });

  afterEach(() => http.verify());

  function open() {
    page.openCreate();
    http.expectOne('/api/users').flush([{ id: 'u1', name: 'Ada' }]);
    http.expectOne('/api/users/u1').flush({ id: 'u1', firstName: 'Ada', lastName: 'A', postalAddress: '', monthlyExpenseLimit: 10, isActive: true });
  }

  it('creates a report first, then creates its first expense', () => {
    open();
    page.create({ userId: 'u1', year: 2026, month: 10, firstExpense });
    const createReport = http.expectOne('/api/expense-reports');
    expect(createReport.request.body).toEqual({ userId: 'u1', year: 2026, month: 10 });
    createReport.flush(report);
    const createExpense = http.expectOne('/api/expense-reports/r1/expenses');
    expect(createExpense.request.body).toEqual(firstExpense);
    createExpense.flush({ id: 'e1', expenseReportId: 'r1', ...firstExpense });
    http.expectOne('/api/expense-reports').flush([report]);
    expect(page.partialCreationWarning()).toBeNull();
  });

  it('retains a successfully created report if the expense fails', () => {
    open();
    page.create({ userId: 'u1', year: 2026, month: 10, firstExpense });
    http.expectOne('/api/expense-reports').flush(report);
    http.expectOne('/api/expense-reports/r1/expenses').flush({ error: 'Quota exceeded' }, { status: 409, statusText: 'Conflict' });
    http.expectOne('/api/expense-reports').flush([report]);
    expect(page.partialCreationWarning()).toContain('Quota exceeded');
    expect(page.reports()).toHaveLength(1);
  });
});
