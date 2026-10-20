import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateReportRequest, ReportDto } from './api.models';

@Injectable({ providedIn: 'root' })
export class ReportsApiService {
  private readonly http = inject(HttpClient);
  private readonly url = '/api/expense-reports';

  list(): Observable<ReportDto[]> { return this.http.get<ReportDto[]>(this.url); }
  get(id: string): Observable<ReportDto> { return this.http.get<ReportDto>(`${this.url}/${encodeURIComponent(id)}`); }
  create(request: CreateReportRequest): Observable<ReportDto> { return this.http.post<ReportDto>(this.url, request); }
  delete(id: string): Observable<void> { return this.http.delete<void>(`${this.url}/${encodeURIComponent(id)}`); }
}
