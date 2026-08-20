import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PingResult } from '../models/models';

@Injectable({ providedIn: 'root' })
export class PingHistoryService {
  private readonly baseUrl = '/api/endpoints/pings';

  constructor(private http: HttpClient) {}

  /** Full ping history across every endpoint, newest first. */
  getAll(): Observable<PingResult[]> {
    return this.http.get<PingResult[]>(this.baseUrl);
  }

  /** Deletes one saved ping from the backend history. */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /** Deletes the complete ping history from the backend. */
  deleteAll(): Observable<void> {
    return this.http.delete<void>(this.baseUrl);
  }
}
