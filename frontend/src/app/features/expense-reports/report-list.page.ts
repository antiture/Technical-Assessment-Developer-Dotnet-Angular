import { ChangeDetectionStrategy, Component, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { CreateReportRequest, ExpensePage, ReportDto, UserInfo } from '../../core/api/api.models';
import { ExpensesApiService } from '../../core/api/expenses-api.service';
import { ReportsApiService } from '../../core/api/reports-api.service';
import { UsersApiService } from '../../core/api/users-api.service';
import { ReportFormComponent } from './report-form.component';

@Component({
  standalone: true,
  imports: [ReportFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './report-list.page.html',
  styleUrl: './report-list.page.scss',
})
export class ReportListPage implements OnInit {
  private readonly reportsApi = inject(ReportsApiService);
  private readonly expensesApi = inject(ExpensesApiService);
  private readonly usersApi = inject(UsersApiService);
  private readonly createDialog = viewChild.required<ElementRef<HTMLDialogElement>>('createDialog');
  private readonly deleteDialog = viewChild.required<ElementRef<HTMLDialogElement>>('deleteDialog');
  private readonly detailDialog = viewChild.required<ElementRef<HTMLDialogElement>>('detailDialog');

  readonly reports = signal<ReportDto[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly eligibleUsers = signal<UserInfo[]>([]);
  readonly usersLoading = signal(false);
  readonly usersError = signal<string | null>(null);
  readonly createOpen = signal(false);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly deletingReport = signal<ReportDto | null>(null);
  readonly formError = signal<string | null>(null);
  readonly deleteError = signal<string | null>(null);
  readonly viewingReport = signal<ReportDto | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal<string | null>(null);
  readonly expensePage = signal<ExpensePage | null>(null);
  readonly expensesLoading = signal(false);
  readonly expensesError = signal<string | null>(null);
  readonly currentPage = signal(1);
  private detailToken = 0;
  private usersToken = 0;

  ngOnInit(): void { this.loadReports(); }

  loadReports(): void {
    this.loading.set(true);
    this.error.set(null);
    this.reportsApi.list().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: data => this.reports.set(data),
      error: err => this.error.set(apiErrorMessage(err)),
    });
  }

  openCreate(): void {
    if (this.saving() || this.deleting()) return;
    this.createOpen.set(true);
    this.formError.set(null);
    this.usersError.set(null);
    this.eligibleUsers.set([]);
    this.usersLoading.set(true);
    const token = ++this.usersToken;
    this.createDialog().nativeElement.showModal();
    this.usersApi.list().pipe(
      switchMap(users => users.length === 0 ? of([] as UserInfo[]) : forkJoin(users.map(user =>
        this.usersApi.get(user.id).pipe(
          map(details => details.isActive ? user : null),
          catchError(() => of(null)),
        ),
      )).pipe(map(details => details.filter((user): user is UserInfo => user !== null)))),
      finalize(() => { if (token === this.usersToken) this.usersLoading.set(false); }),
    ).subscribe({
      next: users => { if (token === this.usersToken) this.eligibleUsers.set(users); },
      error: err => { if (token === this.usersToken) this.usersError.set(apiErrorMessage(err)); },
    });
  }

  closeCreate(): void {
    if (this.saving()) return;
    ++this.usersToken;
    this.createOpen.set(false);
    this.createDialog().nativeElement.close();
  }

  create(request: CreateReportRequest): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.formError.set(null);
    this.reportsApi.create(request).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => { this.closeAfterCreate(); this.loadReports(); },
      error: err => this.formError.set(apiErrorMessage(err)),
    });
  }

  private closeAfterCreate(): void {
    ++this.usersToken;
    this.createOpen.set(false);
    this.createDialog().nativeElement.close();
  }

  openDetail(report: ReportDto): void {
    if (this.saving() || this.deleting() || this.detailDialog().nativeElement.open) return;
    const token = ++this.detailToken;
    this.viewingReport.set(report);
    this.detailError.set(null);
    this.detailLoading.set(true);
    this.expensePage.set(null);
    this.expensesError.set(null);
    this.currentPage.set(1);
    this.detailDialog().nativeElement.showModal();
    this.loadExpenses(report.id, 1, token);
    this.reportsApi.get(report.id).subscribe({
      next: details => {
        if (token !== this.detailToken) return;
        this.viewingReport.set(details);
        this.detailLoading.set(false);
      },
      error: err => {
        if (token !== this.detailToken) return;
        this.detailError.set(apiErrorMessage(err));
        this.detailLoading.set(false);
      },
    });
  }

  loadExpenses(reportId: string, page: number, token = this.detailToken): void {
    if (token !== this.detailToken || page < 1) return;
    this.currentPage.set(page);
    this.expensesLoading.set(true);
    this.expensesError.set(null);
    this.expensesApi.list(reportId, page).subscribe({
      next: result => {
        if (token !== this.detailToken || page !== this.currentPage()) return;
        this.expensePage.set(result);
        this.expensesLoading.set(false);
      },
      error: err => {
        if (token !== this.detailToken || page !== this.currentPage()) return;
        this.expensesError.set(apiErrorMessage(err));
        this.expensesLoading.set(false);
      },
    });
  }

  pageCount(total: number): number { return Math.max(1, Math.ceil(total / 5)); }

  changePage(page: number): void {
    const report = this.viewingReport();
    const result = this.expensePage();
    if (!report || !result || this.expensesLoading() || page < 1) return;
    if (page > Math.max(1, Math.ceil(result.totalCount / 5))) return;
    this.loadExpenses(report.id, page);
  }

  formatExpenseDate(value: string): string {
    // DateOnly from API: parse components in local time, never UTC.
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return value;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  }

  formatAmount(value: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
  }

  closeDetail(): void {
    ++this.detailToken;
    this.detailLoading.set(false);
    this.viewingReport.set(null);
    this.expensePage.set(null);
    this.detailDialog().nativeElement.close();
  }

  onDetailCancel(): void {
    ++this.detailToken;
    this.detailLoading.set(false);
    this.viewingReport.set(null);
    this.expensePage.set(null);
  }

  requestDelete(report: ReportDto): void {
    if (this.deleting() || this.saving()) return;
    this.deleteError.set(null);
    this.deletingReport.set(report);
    this.deleteDialog().nativeElement.showModal();
  }

  closeDelete(): void {
    if (this.deleting()) return;
    this.deletingReport.set(null);
    this.deleteDialog().nativeElement.close();
  }

  confirmDelete(): void {
    const report = this.deletingReport();
    if (!report || this.deleting()) return;
    this.deleteError.set(null);
    this.deleting.set(true);
    this.reportsApi.delete(report.id).pipe(finalize(() => this.deleting.set(false))).subscribe({
      next: () => { this.deletingReport.set(null); this.deleteDialog().nativeElement.close(); this.loadReports(); },
      error: err => this.deleteError.set(apiErrorMessage(err)),
    });
  }

  onCreateCancel(event: Event): void {
    if (this.saving()) { event.preventDefault(); return; }
    ++this.usersToken;
    this.createOpen.set(false);
  }

  onDeleteCancel(event: Event): void {
    if (this.deleting()) { event.preventDefault(); return; }
    this.deletingReport.set(null);
  }
}
