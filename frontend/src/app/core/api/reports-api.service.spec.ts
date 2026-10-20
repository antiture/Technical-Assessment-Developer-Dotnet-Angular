import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ReportsApiService } from './reports-api.service';

describe('ReportsApiService', () => {
  let api: ReportsApiService;
  let http: HttpTestingController;
  const report = { id: 'r1', userId: 'u1', year: 2025, month: 10, title: 'Ada - Octobre 2025' };
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ReportsApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lists reports', () => {
    api.list().subscribe(value => expect(value).toEqual([report]));
    const req = http.expectOne('/api/expense-reports');
    expect(req.request.method).toBe('GET');
    req.flush([report]);
  });

  it('gets report by URL-encoded ID', () => {
    api.get('r/1').subscribe(value => expect(value.title).toBe(report.title));
    const req = http.expectOne('/api/expense-reports/r%2F1');
    expect(req.request.method).toBe('GET');
    req.flush(report);
  });

  it('creates report without submitting its generated title', () => {
    const payload = { userId: 'u1', year: 2025, month: 10 };
    api.create(payload).subscribe(value => expect(value.id).toBe('r1'));
    const req = http.expectOne('/api/expense-reports');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(report);
  });

  it('deletes report', () => {
    api.delete('r1').subscribe();
    const req = http.expectOne('/api/expense-reports/r1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
