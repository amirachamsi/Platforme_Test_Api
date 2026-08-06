import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TestCase } from '../models/models';

@Injectable({ providedIn: 'root' })
export class TestcaseService {
  private readonly baseUrl = '/api/testcases';

  constructor(private http: HttpClient) {}

  list(endpointId?: number): Observable<TestCase[]> {
    const params = endpointId != null ? new HttpParams().set('endpointId', endpointId.toString()) : undefined;
    return this.http.get<TestCase[]>(this.baseUrl, { params });
  }

  getById(id: number): Observable<TestCase> {
    return this.http.get<TestCase>(`${this.baseUrl}/${id}`);
  }

  getByEndpoint(endpointId: number): Observable<TestCase[]> {
    return this.http.get<TestCase[]>(`${this.baseUrl}/endpoint/${endpointId}`);
  }

  create(testCase: TestCase): Observable<TestCase> {
    return this.http.post<TestCase>(this.baseUrl, testCase);
  }

  update(id: number, testCase: TestCase): Observable<TestCase> {
    return this.http.put<TestCase>(`${this.baseUrl}/${id}`, testCase);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
