import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiTarget, ApiEndpoint, TestCase, Execution } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = '/api/targets';

  constructor(private http: HttpClient) {}

  // --- TARGETS ---
  listTargets(): Observable<ApiTarget[]> { 
    return this.http.get<ApiTarget[]>(this.baseUrl); 
  }

  createTarget(t: ApiTarget): Observable<ApiTarget> { 
    return this.http.post<ApiTarget>(this.baseUrl, t); 
  }

  updateTarget(id: number, target: ApiTarget): Observable<ApiTarget> {
    return this.http.put<ApiTarget>(`${this.baseUrl}/${id}`, target);
  }

  deleteTarget(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  // --- ENDPOINTS ---
  listEndpoints(targetId?: number): Observable<ApiEndpoint[]> {
    const params = targetId != null
      ? new HttpParams().set('targetId', targetId.toString())
      : undefined;
    return this.http.get<ApiEndpoint[]>('/api/endpoints', { params });
  }

  createEndpoint(e: ApiEndpoint): Observable<ApiEndpoint> { 
    return this.http.post<ApiEndpoint>('/api/endpoints', e); 
  }

  // --- TEST CASES ---
  listTestCases(endpointId?: number): Observable<TestCase[]> {
    const params = endpointId != null
      ? new HttpParams().set('endpointId', endpointId.toString())
      : undefined;
    return this.http.get<TestCase[]>('/api/test-cases', { params });
  }

  createTestCase(c: TestCase): Observable<TestCase> { 
    return this.http.post<TestCase>('/api/test-cases', c); 
  }

  // --- EXECUTIONS ---
  getExecutionStatus(id: number): Observable<Execution> { 
    return this.http.get<Execution>(`/api/executions/${id}/status`); 
  }

  getExecutionResults(id: number): Observable<any> { 
    return this.http.get(`/api/executions/${id}/results`); 
  }

  stopExecution(id: number, motif: string): Observable<Execution> {
    return this.http.post<Execution>(`/api/executions/${id}/stop`, { motif });
  }
}