import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { UsersApiService } from './users-api.service';
import { SaveUserRequest } from './api.models';

describe('UsersApiService', () => {
  let api: UsersApiService;
  let http: HttpTestingController;
  const payload: SaveUserRequest = { firstName: 'Ada', lastName: 'Lovelace', postalAddress: 'Paris', monthlyExpenseLimit: 5, isActive: true };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(UsersApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lists user summaries', () => {
    const expected = [{ id: 'u1', name: 'Ada Lovelace' }];
    api.list().subscribe(value => expect(value).toEqual(expected));
    const req = http.expectOne('/api/users');
    expect(req.request.method).toBe('GET');
    req.flush(expected);
  });

  it('loads user details with URL encoding', () => {
    api.get('user/1').subscribe(value => expect(value.firstName).toBe('Ada'));
    const req = http.expectOne('/api/users/user%2F1');
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'user/1', ...payload });
  });

  it('creates user with the declared DTO', () => {
    api.create(payload).subscribe(value => expect(value.id).toBe('u1'));
    const req = http.expectOne('/api/users');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 'u1', ...payload });
  });

  it('updates an existing user', () => {
    api.update('u1', payload).subscribe();
    const req = http.expectOne('/api/users/u1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 'u1', ...payload });
  });

  it('deletes a user', () => {
    api.delete('u1').subscribe();
    const req = http.expectOne('/api/users/u1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
