import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiTarget } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ApiTargetService {
  private readonly baseUrl = '/api/targets';

  constructor(private http: HttpClient) {}

  list(): Observable<ApiTarget[]> {
    return this.http.get<ApiTarget[]>(this.baseUrl);
  }

  getById(id: number): Observable<ApiTarget> {
    return this.http.get<ApiTarget>(`${this.baseUrl}/${id}`);
  }

  create(target: ApiTarget): Observable<ApiTarget> {
    return this.http.post<ApiTarget>(this.baseUrl, target);
  }

  update(id: number, target: ApiTarget): Observable<ApiTarget> {
    return this.http.put<ApiTarget>(`${this.baseUrl}/${id}`, target);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
