import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ExpensesApiService } from './expenses-api.service';
import { SaveExpenseRequest } from './api.models';

describe('ExpensesApiService', () => {
  let api: ExpensesApiService;
  let http: HttpTestingController;
  const payload: SaveExpenseRequest = { date: '2025-10-15', description: 'Train', amount: 32.50, store: 'SNCF', street: '1 rue A', postalCode: '75001', city: 'Paris' };
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ExpensesApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it.each([1, 3])('lists page %i with fixed pageSize 5', page => {
    api.list('r1', page).subscribe(value => expect(value.pageSize).toBe(5));
    const req = http.expectOne(request => request.url === '/api/expense-reports/r1/expenses');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe(String(page));
    expect(req.request.params.get('pageSize')).toBe('5');
    req.flush({ page, pageSize: 5, totalCount: 0, items: [] });
  });

  it('defaults to page 1', () => {
    api.list('r1').subscribe();
    const req = http.expectOne(request => request.url === '/api/expense-reports/r1/expenses');
    expect(req.request.params.get('page')).toBe('1');
    req.flush({ page: 1, pageSize: 5, totalCount: 0, items: [] });
  });

  it('creates expense with unchanged DateOnly string and billing address', () => {
    api.create('r1', payload).subscribe(value => expect(value.date).toBe('2025-10-15'));
    const req = http.expectOne('/api/expense-reports/r1/expenses');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 'e1', expenseReportId: 'r1', ...payload });
  });

  it('updates expense with encoded IDs', () => {
    api.update('r/1', 'e/1', payload).subscribe();
    const req = http.expectOne('/api/expense-reports/r%2F1/expenses/e%2F1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 'e/1', expenseReportId: 'r/1', ...payload });
  });

  it('deletes expense', () => {
    api.delete('r1', 'e1').subscribe();
    const req = http.expectOne('/api/expense-reports/r1/expenses/e1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
