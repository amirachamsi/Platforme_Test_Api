import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiEndpoint } from '../models/models';

@Injectable({ providedIn: 'root' })
export class EndpointService {
  private readonly baseUrl = '/api/endpoints';

  constructor(private http: HttpClient) {}

  list(targetId?: number): Observable<ApiEndpoint[]> {
    const params = targetId != null ? new HttpParams().set('targetId', targetId.toString()) : undefined;
    return this.http.get<ApiEndpoint[]>(this.baseUrl, { params });
  }

  getById(id: number): Observable<ApiEndpoint> {
    return this.http.get<ApiEndpoint>(`${this.baseUrl}/${id}`);
  }

  getByTarget(targetId: number): Observable<ApiEndpoint[]> {
    return this.http.get<ApiEndpoint[]>(`${this.baseUrl}/target/${targetId}`);
  }

  create(endpoint: ApiEndpoint): Observable<ApiEndpoint> {
    return this.http.post<ApiEndpoint>(this.baseUrl, endpoint);
  }

  update(id: number, endpoint: ApiEndpoint): Observable<ApiEndpoint> {
    return this.http.put<ApiEndpoint>(`${this.baseUrl}/${id}`, endpoint);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  ping(id: number): Observable<void> {
    return this.http.get<void>(`${this.baseUrl}/ping/${id}`);
  }
}
