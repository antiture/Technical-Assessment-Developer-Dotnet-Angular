import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReportListPage } from './report-list.page';

const report = { id: 'r1', userId: 'u1', year: 2026, month: 10, title: 'Ada - Octobre 2026' };
const requestBody = { date: '2026-10-15', description: 'Train', amount: 24.5, store: 'SNCF', street: '1 rue A', postalCode: '75020', city: 'Paris' };
const expense = { id: 'e1', expenseReportId: 'r1', ...requestBody };
const page = (number: number, totalCount: number, items = [expense]) => ({ page: number, pageSize: 5, totalCount, items });

describe('Expense operations regression', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<ReportListPage>;
  let component: ReportListPage;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportListPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ReportListPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne('/api/expense-reports').flush([report]);
    component.openDetail(report);
    http.expectOne('/api/expense-reports/r1').flush(report);
    http.expectOne(req => req.url === '/api/expense-reports/r1/expenses').flush(page(1, 1));
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('creates an expense and refreshes the first page', () => {
    component.openExpenseEditor();
    expect(component.expenseEditorOpen()).toBe(true);
    component.saveExpense(requestBody);
    const create = http.expectOne('/api/expense-reports/r1/expenses');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(requestBody);
    create.flush(expense);
    const refresh = http.expectOne(req => req.url === '/api/expense-reports/r1/expenses');
    expect(refresh.request.params.get('page')).toBe('1');
    refresh.flush(page(1, 2));
    expect(component.expenseEditorOpen()).toBe(false);
  });

  it('updates an existing expense without losing its identity', () => {
    component.openExpenseEditor(expense);
    const updated = { ...requestBody, description: 'Taxi' };
    component.saveExpense(updated);
    const put = http.expectOne('/api/expense-reports/r1/expenses/e1');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual(updated);
    put.flush({ ...expense, ...updated });
    http.expectOne(req => req.url === '/api/expense-reports/r1/expenses').flush(page(1, 1, [{ ...expense, ...updated }]));
    expect(component.expenseEditorOpen()).toBe(false);
  });

  it('keeps the editor open and reports quota failure on HTTP 409', () => {
    component.openExpenseEditor();
    component.saveExpense(requestBody);
    http.expectOne('/api/expense-reports/r1/expenses')
      .flush({ error: 'Monthly quota exceeded' }, { status: 409, statusText: 'Conflict' });
    expect(component.expenseEditorOpen()).toBe(true);
    expect(component.expenseFormError()).toContain('Monthly quota exceeded');
    expect(component.expensePage()?.totalCount).toBe(1);
  });

  it('prevents closing the editor while saving', () => {
    component.openExpenseEditor();
    component.saveExpense(requestBody);
    const pending = http.expectOne('/api/expense-reports/r1/expenses');
    component.closeExpenseEditor();
    expect(component.expenseEditorOpen()).toBe(true);
    const event = new Event('cancel', { cancelable: true });
    component.onExpenseCancel(event);
    expect(event.defaultPrevented).toBe(true);
    pending.flush(expense);
    http.expectOne(req => req.url === '/api/expense-reports/r1/expenses').flush(page(1, 2));
  });

  it('does not delete until confirmation; refreshes after DELETE', () => {
    component.requestExpenseDelete(expense);
    expect(http.match('/api/expense-reports/r1/expenses/e1')).toHaveLength(0);
    component.confirmExpenseDelete();
    const deletion = http.expectOne('/api/expense-reports/r1/expenses/e1');
    expect(deletion.request.method).toBe('DELETE');
    deletion.flush(null);
    http.expectOne(req => req.url === '/api/expense-reports/r1/expenses').flush(page(1, 0, []));
    expect(component.expenseToDelete()).toBeNull();
  });

  it('retains deletion confirmation when DELETE fails', () => {
    component.requestExpenseDelete(expense);
    component.confirmExpenseDelete();
    http.expectOne('/api/expense-reports/r1/expenses/e1')
      .flush({ error: 'Cannot delete' }, { status: 409, statusText: 'Conflict' });
    expect(component.expenseToDelete()?.id).toBe('e1');
    expect(component.expenseDeleteError()).toContain('Cannot delete');
    expect(component.expensePage()?.totalCount).toBe(1);
  });

  it('returns to the previous page when the last row of page 2 is deleted', () => {
    // Establish six persisted expenses before navigating to the second page.
    component.loadExpenses('r1', 1);
    http.expectOne(req => req.url === '/api/expense-reports/r1/expenses' && req.params.get('page') === '1')
      .flush(page(1, 6));

    component.changePage(2);
    http.expectOne(req => req.url === '/api/expense-reports/r1/expenses' && req.params.get('page') === '2')
      .flush(page(2, 6));
    component.requestExpenseDelete(expense);
    component.confirmExpenseDelete();
    http.expectOne('/api/expense-reports/r1/expenses/e1').flush(null);
    const reload = http.expectOne(req => req.url === '/api/expense-reports/r1/expenses');
    expect(reload.request.params.get('page')).toBe('1');
    reload.flush(page(1, 5));
    expect(component.currentPage()).toBe(1);
  });

  it('never treats a current-page subtotal as the total amount', () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.querySelector('dialog[aria-labelledby="detail-report-title"]')?.textContent ?? '';
    expect(text).toContain('24,50');
    expect(text).not.toContain('Montant total');
  });
});
