import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SaveUserRequest, UserDetails, UserInfo } from './api.models';

@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly http = inject(HttpClient);
  private readonly url = '/api/users';

  list(): Observable<UserInfo[]> { return this.http.get<UserInfo[]>(this.url); }
  get(id: string): Observable<UserDetails> { return this.http.get<UserDetails>(`${this.url}/${encodeURIComponent(id)}`); }
  create(request: SaveUserRequest): Observable<UserDetails> { return this.http.post<UserDetails>(this.url, request); }
  update(id: string, request: SaveUserRequest): Observable<UserDetails> { return this.http.put<UserDetails>(`${this.url}/${encodeURIComponent(id)}`, request); }
  delete(id: string): Observable<void> { return this.http.delete<void>(`${this.url}/${encodeURIComponent(id)}`); }
}
