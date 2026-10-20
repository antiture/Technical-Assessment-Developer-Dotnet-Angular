import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { finalize } from 'rxjs';
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
  readonly users = signal<UserInfo[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly editorOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly editingUser = signal<UserDetails | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal<string | null>(null);
  readonly saving = signal(false);
  private selectionToken = 0;

  ngOnInit(): void { this.loadUsers(); }

  loadUsers(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.list().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: users => this.users.set(users),
      error: error => this.error.set(apiErrorMessage(error)),
    });
  }

  startCreate(): void {
    ++this.selectionToken;
    this.error.set(null);
    this.editingId.set(null);
    this.editingUser.set(null);
    this.detailError.set(null);
    this.detailLoading.set(false);
    this.editorOpen.set(true);
  }

  startEdit(id: string): void {
    const token = ++this.selectionToken;
    this.error.set(null);
    this.editingId.set(id);
    this.editingUser.set(null);
    this.detailError.set(null);
    this.detailLoading.set(true);
    this.editorOpen.set(true);
    this.api.get(id).subscribe({
      next: user => { if (token === this.selectionToken) { this.editingUser.set(user); this.detailLoading.set(false); } },
      error: error => { if (token === this.selectionToken) { this.detailError.set(apiErrorMessage(error)); this.detailLoading.set(false); } },
    });
  }

  closeEditor(): void {
    if (this.saving()) return;
    ++this.selectionToken;
    this.editorOpen.set(false);
  }

  save(request: SaveUserRequest): void {
    if (this.saving()) return;
    this.error.set(null);
    const id = this.editingId();
    this.saving.set(true);
    const operation = id ? this.api.update(id, request) : this.api.create(request);
    operation.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => { ++this.selectionToken; this.editorOpen.set(false); this.loadUsers(); },
      error: error => this.error.set(apiErrorMessage(error)),
    });
  }
}
