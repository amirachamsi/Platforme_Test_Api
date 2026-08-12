import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Execution } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ExecutionService {
  private readonly baseUrl = '/api/executions';

  constructor(private http: HttpClient) {}

  /** Blocking call — resolves once k6 has finished running and the result is saved. */
  execute(testCaseId: number): Observable<Execution> {
    return this.http.post<Execution>(`${this.baseUrl}/testcase/${testCaseId}`, {});
  }

  /** Backend returns 204 (no body) if this TestCase has never been run; Angular resolves that as null. */
  getLatest(testCaseId: number): Observable<Execution | null> {
    return this.http.get<Execution | null>(`${this.baseUrl}/testcase/${testCaseId}/latest`);
  }

  getHistory(testCaseId: number): Observable<Execution[]> {
    return this.http.get<Execution[]>(`${this.baseUrl}/testcase/${testCaseId}`);
  }

  /** Every execution across every test case, newest first — for the History page. */
  getAll(): Observable<Execution[]> {
    return this.http.get<Execution[]>(this.baseUrl);
  }
}