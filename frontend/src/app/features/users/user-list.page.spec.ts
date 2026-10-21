import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { UserListPage } from './user-list.page';

const savedUser = { id: '77', firstName: 'Ada', lastName: 'Lovelace', postalAddress: 'Paris', monthlyExpenseLimit: 5, isActive: false };

describe('UserListPage', () => {
  let fixture: ComponentFixture<UserListPage>;
  let http: HttpTestingController;

  beforeEach(async () => {
    // jsdom does not implement the native HTMLDialogElement showModal/close API.
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
    await TestBed.configureTestingModule({
      imports: [UserListPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(UserListPage);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/users').flush([{ id: '77', name: 'Ada Lovelace' }]);
    http.expectOne('/api/users/77').flush(savedUser);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());


  it('shows the actual status and only the corresponding action', () => {
    fixture.detectChanges();
    const row = fixture.nativeElement.querySelector('tbody tr') as HTMLElement;
    expect(row.textContent).toContain('Inactif');
    expect(row.textContent).toContain('Activer');
    expect(row.textContent).not.toContain('Désactiver');
  });

  it('never offers an activation operation when the detail request fails', () => {
    fixture.componentInstance.loadUsers();
    http.expectOne('/api/users').flush([{ id: '77', name: 'Ada Lovelace' }]);
    http.expectOne('/api/users/77').flush({ error: 'Unavailable' }, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    const row = fixture.nativeElement.querySelector('tbody tr') as HTMLElement;
    expect(row.textContent).toContain('Indisponible');
    expect(row.textContent).not.toContain('Activer');
    expect(row.textContent).not.toContain('Désactiver');
  });

  it('keeps the inactive status after an unsuccessful activation', () => {
    fixture.componentInstance.changeActive('77', true);
    http.expectOne('/api/users/77').flush(savedUser);
    http.expectOne(req => req.url === '/api/users/77' && req.method === 'PUT')
      .flush({ error: 'Blocked' }, { status: 409, statusText: 'Conflict' });
    expect(fixture.componentInstance.activity()['77']).toBe(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('tbody tr').textContent).toContain('Inactif');
  });

  it('lists users without inventing missing profile fields', () => {
    expect(fixture.nativeElement.textContent).toContain('Ada Lovelace');
    expect(fixture.componentInstance.users()).toEqual([{ id: '77', name: 'Ada Lovelace' }]);
  });

  it('opens a native modal for creation and closes it on cancellation', () => {
    fixture.componentInstance.startCreate();
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog:not(.delete-dialog)') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain('Créer un utilisateur');
    fixture.componentInstance.closeEditor();
    expect(dialog.open).toBe(false);
  });

  it('blocks Escape dismissal while a save is in progress', () => {
    fixture.componentInstance.startCreate();
    fixture.componentInstance.save({ firstName: 'Grace', lastName: 'Hopper', postalAddress: '', monthlyExpenseLimit: 10, isActive: true });
    const dialog = fixture.nativeElement.querySelector('dialog:not(.delete-dialog)') as HTMLDialogElement;
    const cancel = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(dialog.open).toBe(true);
    http.expectOne('/api/users').flush({ error: 'Invalid user' }, { status: 400, statusText: 'Bad Request' });
  });

  it('activates with full profile preserved and reloads', () => {
    fixture.componentInstance.changeActive('77', true);
    http.expectOne('/api/users/77').flush(savedUser);
    const update = http.expectOne('/api/users/77');
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual({
      firstName: 'Ada', lastName: 'Lovelace', postalAddress: 'Paris',
      monthlyExpenseLimit: 5, isActive: true,
    });
    update.flush({ ...savedUser, isActive: true });
    http.expectOne('/api/users').flush([{ id: '77', name: 'Ada Lovelace' }]);
    http.expectOne('/api/users/77').flush({ ...savedUser, isActive: true });
  });

  it('confirms and soft-deletes through the existing DELETE endpoint', () => {
    fixture.componentInstance.requestDelete('77');
    http.expectOne('/api/users/77').flush(savedUser);
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('.delete-dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    fixture.componentInstance.confirmDelete();
    const deletion = http.expectOne('/api/users/77');
    expect(deletion.request.method).toBe('DELETE');
    deletion.flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne('/api/users').flush([]);
    expect(dialog.open).toBe(false);
    expect(fixture.componentInstance.users()).toEqual([]);
  });

  it('does not delete when confirmation is cancelled', () => {
    fixture.componentInstance.requestDelete('77');
    http.expectOne('/api/users/77').flush(savedUser);
    fixture.componentInstance.cancelDelete();
    http.expectNone(req => req.method === 'DELETE');
    expect(fixture.componentInstance.confirmingDelete()).toBeNull();
  });

  it('loads the full profile before editing', () => {
    fixture.componentInstance.startEdit('77');
    const req = http.expectOne('/api/users/77');
    expect(req.request.method).toBe('GET');
    req.flush(savedUser);
    fixture.detectChanges();
    expect(fixture.componentInstance.editingUser()).toEqual(savedUser);
    expect((fixture.nativeElement.querySelector('dialog:not(.delete-dialog)') as HTMLDialogElement).open).toBe(true);
  });

  it('creates a user then reloads the list', () => {
    fixture.componentInstance.startCreate();
    fixture.componentInstance.save({ firstName: 'Grace', lastName: 'Hopper', postalAddress: '', monthlyExpenseLimit: 10, isActive: true });
    const req = http.expectOne('/api/users');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.isActive).toBe(true);
    req.flush({ ...savedUser, firstName: 'Grace', lastName: 'Hopper' });
    http.expectOne('/api/users').flush([{ id: '77', name: 'Ada Lovelace' }, { id: '88', name: 'Grace Hopper' }]);
    http.expectOne('/api/users/77').flush(savedUser);
    http.expectOne('/api/users/88').flush({ ...savedUser, id: '88', firstName: 'Grace', lastName: 'Hopper' });
    expect(fixture.componentInstance.editorOpen()).toBe(false);
    expect(fixture.componentInstance.users()).toHaveLength(2);
  });

  it('updates without changing the inactive flag', () => {
    fixture.componentInstance.startEdit('77');
    http.expectOne('/api/users/77').flush(savedUser);
    fixture.componentInstance.save({ firstName: 'Ada', lastName: 'Byron', postalAddress: 'Paris', monthlyExpenseLimit: 5, isActive: false });
    const req = http.expectOne('/api/users/77');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.isActive).toBe(false);
    req.flush({ ...savedUser, lastName: 'Byron' });
    http.expectOne('/api/users').flush([{ id: '77', name: 'Ada Byron' }]);
    http.expectOne('/api/users/77').flush({ ...savedUser, lastName: 'Byron' });
    expect(fixture.componentInstance.users()[0].name).toBe('Ada Byron');
  });

  it('shows server validation errors and keeps the editor open', () => {
    fixture.componentInstance.startCreate();
    fixture.componentInstance.save({ firstName: 'Ada', lastName: 'Lee', postalAddress: '', monthlyExpenseLimit: 1, isActive: true });
    http.expectOne('/api/users').flush({ error: 'Invalid user' }, { status: 400, statusText: 'Bad Request' });
    expect(fixture.componentInstance.error()).toBe('Invalid user');
    expect(fixture.componentInstance.editorOpen()).toBe(true);
  });
  it('shows five users per page and navigates to the second page', () => {
    const users = Array.from({ length: 7 }, (_, i) => ({ id: String(i + 1), name: `User ${i + 1}` }));
    fixture.componentInstance.loadUsers();
    http.expectOne('/api/users').flush(users);
    for (const u of users) {
      http.expectOne(`/api/users/${u.id}`).flush({ ...savedUser, id: u.id, isActive: true });
    }
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(5);
    expect(fixture.nativeElement.textContent).toContain('Page 1 / 2');
    fixture.componentInstance.changePage(2);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(fixture.nativeElement.textContent).toContain('Page 2 / 2');
  });

  it('prevents navigation outside the available pages', () => {
    fixture.componentInstance.changePage(2);
    expect(fixture.componentInstance.currentPage()).toBe(1);
    fixture.componentInstance.changePage(0);
    expect(fixture.componentInstance.currentPage()).toBe(1);
  });

  it('clamps the page when refreshed data removes the final page', () => {
    const users = Array.from({ length: 6 }, (_, i) => ({ id: String(i + 1), name: `User ${i + 1}` }));
    fixture.componentInstance.loadUsers();
    http.expectOne('/api/users').flush(users);
    for (const u of users) {
      http.expectOne(`/api/users/${u.id}`).flush({ ...savedUser, id: u.id, isActive: true });
    }
    fixture.componentInstance.changePage(2);
    expect(fixture.componentInstance.currentPage()).toBe(2);
    fixture.componentInstance.loadUsers();
    http.expectOne('/api/users').flush(users.slice(0, 5));
    for (const u of users.slice(0, 5)) {
      http.expectOne(`/api/users/${u.id}`).flush({ ...savedUser, id: u.id, isActive: true });
    }
    fixture.detectChanges();
    expect(fixture.componentInstance.currentPage()).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(5);
  });

});
