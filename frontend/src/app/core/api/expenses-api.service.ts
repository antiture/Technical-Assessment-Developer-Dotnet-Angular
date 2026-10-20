import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ExpenseDto, ExpensePage, SaveExpenseRequest } from './api.models';

@Injectable({ providedIn: 'root' })
export class ExpensesApiService {
  private readonly http = inject(HttpClient);
  private baseUrl(reportId: string): string { return `/api/expense-reports/${encodeURIComponent(reportId)}/expenses`; }

  list(reportId: string, page = 1): Observable<ExpensePage> {
    const params = new HttpParams().set('page', page.toString()).set('pageSize', '5');
    return this.http.get<ExpensePage>(this.baseUrl(reportId), { params });
  }
  create(reportId: string, request: SaveExpenseRequest): Observable<ExpenseDto> {
    return this.http.post<ExpenseDto>(this.baseUrl(reportId), request);
  }
  update(reportId: string, expenseId: string, request: SaveExpenseRequest): Observable<ExpenseDto> {
    return this.http.put<ExpenseDto>(`${this.baseUrl(reportId)}/${encodeURIComponent(expenseId)}`, request);
  }
  delete(reportId: string, expenseId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl(reportId)}/${encodeURIComponent(expenseId)}`);
  }
}
