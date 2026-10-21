import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { CreateReportRequest, ExpenseDto, ExpensePage, ReportDto, SaveExpenseRequest, UserInfo } from '../../core/api/api.models';
import { ExpensesApiService } from '../../core/api/expenses-api.service';
import { ReportsApiService } from '../../core/api/reports-api.service';
import { UsersApiService } from '../../core/api/users-api.service';
import { ReportFormComponent } from './report-form.component';
import { ExpenseFormComponent } from '../expenses/expense-form.component';

@Component({
  standalone: true,
  imports: [ReportFormComponent, ExpenseFormComponent],
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
  private readonly expenseDialog = viewChild.required<ElementRef<HTMLDialogElement>>('expenseDialog');
  private readonly expenseDeleteDialog = viewChild.required<ElementRef<HTMLDialogElement>>('expenseDeleteDialog');

  readonly reports = signal<ReportDto[]>([]);
  readonly reportPageSize = 5;
  readonly reportPage = signal(1);
  readonly reportPageCount = computed(() =>
    Math.max(1, Math.ceil(this.reports().length / this.reportPageSize)),
  );
  readonly visibleReports = computed(() => {
    const start = (this.reportPage() - 1) * this.reportPageSize;
    return this.reports().slice(start, start + this.reportPageSize);
  });

  changeReportPage(page: number): void {
    if (page < 1 || page > this.reportPageCount()) return;
    this.reportPage.set(page);
  }

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
  readonly editingExpense = signal<ExpenseDto | null>(null);
  readonly expenseEditorOpen = signal(false);
  readonly expenseSaving = signal(false);
  readonly expenseFormError = signal<string | null>(null);
  readonly expenseToDelete = signal<ExpenseDto | null>(null);
  readonly expenseDeleting = signal(false);
  readonly expenseDeleteError = signal<string | null>(null);
  readonly partialCreationWarning = signal<string | null>(null);
  private detailToken = 0;
  private usersToken = 0;

  ngOnInit(): void { this.loadReports(); }

  loadReports(): void {
    this.loading.set(true);
    this.error.set(null);
    this.reportsApi.list().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: data => {
        this.reports.set(data);
        this.reportPage.update(page => Math.min(page, this.reportPageCount()));
      },
      error: err => this.error.set(apiErrorMessage(err)),
    });
  }

  openCreate(): void {
    if (this.saving() || this.deleting()) return;
    this.createOpen.set(true);
    this.formError.set(null);
    this.partialCreationWarning.set(null);
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

  create(request: CreateReportRequest & { firstExpense?: SaveExpenseRequest }): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.formError.set(null);
    const { firstExpense, ...reportRequest } = request;
    this.reportsApi.create(reportRequest).pipe(
      switchMap(report => firstExpense
        ? this.expensesApi.create(report.id, firstExpense).pipe(
            map(() => ({ report, expenseError: null as string | null })),
            catchError(err => of({ report, expenseError: apiErrorMessage(err) })),
          )
        : of({ report, expenseError: null as string | null })),
      finalize(() => this.saving.set(false)),
    ).subscribe({
      next: ({ report, expenseError }) => {
        this.closeAfterCreate();
        this.loadReports();
        if (expenseError) {
          this.partialCreationWarning.set(`La note « ${report.title} » a été créée, mais la première dépense a échoué : ${expenseError}. Ouvrez Consulter pour réessayer.`);
        } else {
          this.partialCreationWarning.set(null);
        }
      },
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
    if (this.expenseSaving() || this.expenseDeleting()) return;
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

  openExpenseEditor(expense: ExpenseDto | null = null): void {
    if (!this.viewingReport() || this.expenseSaving() || this.expenseDeleting()) return;
    this.editingExpense.set(expense);
    this.expenseFormError.set(null);
    this.expenseEditorOpen.set(true);
    this.expenseDialog().nativeElement.showModal();
  }

  closeExpenseEditor(): void {
    if (this.expenseSaving()) return;
    this.expenseEditorOpen.set(false);
    this.expenseDialog().nativeElement.close();
  }

  saveExpense(request: SaveExpenseRequest): void {
    const report = this.viewingReport();
    if (!report || this.expenseSaving()) return;
    const expense = this.editingExpense();
    this.expenseSaving.set(true);
    this.expenseFormError.set(null);
    const operation = expense
      ? this.expensesApi.update(report.id, expense.id, request)
      : this.expensesApi.create(report.id, request);
    operation.pipe(finalize(() => this.expenseSaving.set(false))).subscribe({
      next: () => {
        this.expenseEditorOpen.set(false);
        this.expenseDialog().nativeElement.close();
        this.loadExpenses(report.id, expense ? this.currentPage() : 1);
      },
      error: err => this.expenseFormError.set(apiErrorMessage(err)),
    });
  }

  requestExpenseDelete(expense: ExpenseDto): void {
    if (this.expenseDeleting()) return;
    this.expenseToDelete.set(expense);
    this.expenseDeleteError.set(null);
    this.expenseDeleteDialog().nativeElement.showModal();
  }

  closeExpenseDelete(): void {
    if (this.expenseDeleting()) return;
    this.expenseToDelete.set(null);
    this.expenseDeleteDialog().nativeElement.close();
  }

  confirmExpenseDelete(): void {
    const report = this.viewingReport();
    const expense = this.expenseToDelete();
    if (!report || !expense || this.expenseDeleting()) return;
    this.expenseDeleting.set(true);
    this.expenseDeleteError.set(null);
    this.expensesApi.delete(report.id, expense.id).pipe(
      finalize(() => this.expenseDeleting.set(false)),
    ).subscribe({
      next: () => {
        this.expenseToDelete.set(null);
        this.expenseDeleteDialog().nativeElement.close();
        const page = this.expensePage();
        const remaining = Math.max(0, (page?.totalCount ?? 1) - 1);
        this.loadExpenses(report.id, Math.min(this.currentPage(), this.pageCount(remaining)));
      },
      error: err => this.expenseDeleteError.set(apiErrorMessage(err)),
    });
  }

  onExpenseCancel(event: Event): void {
    if (this.expenseSaving()) { event.preventDefault(); return; }
    this.expenseEditorOpen.set(false);
  }

  onExpenseDeleteCancel(event: Event): void {
    if (this.expenseDeleting()) { event.preventDefault(); return; }
    this.expenseToDelete.set(null);
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
