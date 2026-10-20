import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { UserListPage } from './user-list.page';

const savedUser = { id: '77', firstName: 'Ada', lastName: 'Lovelace', postalAddress: 'Paris', monthlyExpenseLimit: 5, isActive: false };

describe('UserListPage', () => {
  let fixture: ComponentFixture<UserListPage>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserListPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(UserListPage);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/users').flush([{ id: '77', name: 'Ada Lovelace' }]);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('lists users without inventing missing profile fields', () => {
    expect(fixture.nativeElement.textContent).toContain('Ada Lovelace');
    expect(fixture.componentInstance.users()).toEqual([{ id: '77', name: 'Ada Lovelace' }]);
  });

  it('loads the full profile before editing', () => {
    fixture.componentInstance.startEdit('77');
    const req = http.expectOne('/api/users/77');
    expect(req.request.method).toBe('GET');
    req.flush(savedUser);
    fixture.detectChanges();
    expect(fixture.componentInstance.editingUser()).toEqual(savedUser);
  });

  it('creates a user then reloads the list', () => {
    fixture.componentInstance.startCreate();
    fixture.componentInstance.save({ firstName: 'Grace', lastName: 'Hopper', postalAddress: '', monthlyExpenseLimit: 10, isActive: true });
    const req = http.expectOne('/api/users');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.isActive).toBe(true);
    req.flush({ ...savedUser, firstName: 'Grace', lastName: 'Hopper' });
    http.expectOne('/api/users').flush([{ id: '77', name: 'Ada Lovelace' }, { id: '88', name: 'Grace Hopper' }]);
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
    expect(fixture.componentInstance.users()[0].name).toBe('Ada Byron');
  });

  it('shows server validation errors and keeps the editor open', () => {
    fixture.componentInstance.startCreate();
    fixture.componentInstance.save({ firstName: 'Ada', lastName: 'Lee', postalAddress: '', monthlyExpenseLimit: 1, isActive: true });
    http.expectOne('/api/users').flush({ error: 'Invalid user' }, { status: 400, statusText: 'Bad Request' });
    expect(fixture.componentInstance.error()).toBe('Invalid user');
    expect(fixture.componentInstance.editorOpen()).toBe(true);
  });
});
