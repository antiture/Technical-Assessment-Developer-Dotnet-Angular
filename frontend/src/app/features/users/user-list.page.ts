import { ChangeDetectionStrategy, Component, ElementRef, inject, OnInit, signal, computed, viewChild } from '@angular/core';
import { catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { SaveUserRequest, UserDetails, UserInfo } from '../../core/api/api.models';
import { UsersApiService } from '../../core/api/users-api.service';
import { UserFormComponent } from './user-form.component';

@Component({
  standalone: true,
  imports: [UserFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-list.page.html',
  styleUrl: './user-list.page.scss',
})
export class UserListPage implements OnInit {
  private readonly api = inject(UsersApiService);
  private readonly editorDialog = viewChild.required<ElementRef<HTMLDialogElement>>('editorDialog');

  readonly users = signal<UserInfo[]>([]);
  readonly pageSize = 5;
  readonly currentPage = signal(1);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.users().length / this.pageSize)));
  readonly pagedUsers = computed(() => {
    const first = (this.currentPage() - 1) * this.pageSize;
    return this.users().slice(first, first + this.pageSize);
  });

  changePage(page: number): void {
    if (!Number.isInteger(page) || page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
  }

  // Null = detail unavailable: never infer an activity state from the list response.
  readonly activity = signal<Record<string, boolean | null>>({});
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly editorOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly editingUser = signal<UserDetails | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly actionBusyId = signal<string | null>(null);
  readonly confirmingDelete = signal<UserDetails | null>(null);
  readonly actionError = signal<string | null>(null);
  private readonly deleteDialog = viewChild.required<ElementRef<HTMLDialogElement>>('deleteDialog');
  private selectionToken = 0;

  ngOnInit(): void { this.loadUsers(); }

  loadUsers(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.list().pipe(
      switchMap(users => {
        this.users.set(users);
        this.currentPage.update(page => Math.min(page, Math.max(1, Math.ceil(users.length / this.pageSize))));
        this.activity.set({});
        if (users.length === 0) return of({} as Record<string, boolean | null>);
        return forkJoin(users.map(user =>
          this.api.get(user.id).pipe(
            map(details => ({ id: user.id, active: details.isActive as boolean | null })),
            catchError(() => of({ id: user.id, active: null as boolean | null })),
          ),
        )).pipe(map(details => Object.fromEntries(details.map(x => [x.id, x.active]))));
      }),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: states => this.activity.set(states),
      error: error => this.error.set(apiErrorMessage(error)),
    });
  }

  changeActive(id: string, active: boolean): void {
    if (this.actionBusyId() || this.saving() || this.activity()[id] !== !active) return;
    this.actionError.set(null);
    this.actionBusyId.set(id);
    // GET /users contains id/name only; preserve the complete profile on PUT.
    this.api.get(id).subscribe({
      next: user => {
        this.api.update(id, {
          firstName: user.firstName, lastName: user.lastName,
          postalAddress: user.postalAddress, monthlyExpenseLimit: user.monthlyExpenseLimit,
          isActive: active,
        })
          .pipe(finalize(() => this.actionBusyId.set(null)))
          .subscribe({
            next: () => this.loadUsers(),
            error: error => this.actionError.set(apiErrorMessage(error)),
          });
      },
      error: error => {
        this.actionBusyId.set(null);
        this.actionError.set(apiErrorMessage(error));
      },
    });
  }

  requestDelete(id: string): void {
    if (this.actionBusyId() || this.saving()) return;
    this.actionError.set(null);
    this.actionBusyId.set(id);
    this.api.get(id).subscribe({
      next: user => {
        this.actionBusyId.set(null);
        this.confirmingDelete.set(user);
        const dialog = this.deleteDialog().nativeElement;
        if (!dialog.open) dialog.showModal();
      },
      error: error => {
        this.actionBusyId.set(null);
        this.actionError.set(apiErrorMessage(error));
      },
    });
  }

  cancelDelete(event?: Event): void {
    event?.preventDefault();
    if (this.actionBusyId()) return;
    this.confirmingDelete.set(null);
    const dialog = this.deleteDialog().nativeElement;
    if (dialog.open) dialog.close();
  }

  confirmDelete(): void {
    const user = this.confirmingDelete();
    if (!user || this.actionBusyId()) return;
    this.actionError.set(null);
    this.actionBusyId.set(user.id);
    this.api.delete(user.id).pipe(finalize(() => this.actionBusyId.set(null))).subscribe({
      next: () => {
        this.confirmingDelete.set(null);
        this.deleteDialog().nativeElement.close();
        this.loadUsers();
      },
      error: error => this.actionError.set(apiErrorMessage(error)),
    });
  }

  private openEditor(): void {
    this.editorOpen.set(true);
    const dialog = this.editorDialog().nativeElement;
    if (!dialog.open) dialog.showModal();
  }

  startCreate(): void {
    if (this.saving()) return;
    ++this.selectionToken;
    this.error.set(null);
    this.editingId.set(null);
    this.editingUser.set(null);
    this.detailError.set(null);
    this.detailLoading.set(false);
    this.openEditor();
  }

  startEdit(id: string): void {
    if (this.saving()) return;
    const token = ++this.selectionToken;
    this.error.set(null);
    this.editingId.set(id);
    this.editingUser.set(null);
    this.detailError.set(null);
    this.detailLoading.set(true);
    this.openEditor();
    this.api.get(id).subscribe({
      next: user => {
        if (token !== this.selectionToken) return;
        this.editingUser.set(user);
        this.detailLoading.set(false);
      },
      error: error => {
        if (token !== this.selectionToken) return;
        this.detailError.set(apiErrorMessage(error));
        this.detailLoading.set(false);
      },
    });
  }

  onDialogCancel(event: Event): void {
    // The native cancel event fires before the browser closes the dialog.
    // Prevent native dismissal so in-flight saves cannot be interrupted.
    event.preventDefault();
    this.closeEditor();
  }

  closeEditor(): void {
    if (this.saving()) return;
    ++this.selectionToken;
    this.editorOpen.set(false);
    const dialog = this.editorDialog().nativeElement;
    if (dialog.open) dialog.close();
  }

  save(request: SaveUserRequest): void {
    if (this.saving()) return;
    this.error.set(null);
    const id = this.editingId();
    this.saving.set(true);
    const operation = id ? this.api.update(id, request) : this.api.create(request);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.closeEditorAfterSave();
        this.loadUsers();
      },
      error: error => this.error.set(apiErrorMessage(error)),
    });
  }

  private closeEditorAfterSave(): void {
    ++this.selectionToken;
    this.editorOpen.set(false);
    const dialog = this.editorDialog().nativeElement;
    if (dialog.open) dialog.close();
  }
}
