import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Execution } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ExecutionService {
  private readonly baseUrl = '/api/executions';

  constructor(private http: HttpClient) {}

  list(testcaseId?: number): Observable<Execution[]> {
    const params = testcaseId != null ? new HttpParams().set('testcaseId', testcaseId.toString()) : undefined;
    return this.http.get<Execution[]>(this.baseUrl, { params });
  }

  getById(id: number): Observable<Execution> {
    return this.http.get<Execution>(`${this.baseUrl}/${id}`);
  }

  getByTestcase(testcaseId: number): Observable<Execution[]> {
    return this.http.get<Execution[]>(`${this.baseUrl}/testcase/${testcaseId}`);
  }

  create(execution: Execution): Observable<Execution> {
    return this.http.post<Execution>(this.baseUrl, execution);
  }

  update(id: number, execution: Execution): Observable<Execution> {
    return this.http.put<Execution>(`${this.baseUrl}/${id}`, execution);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
