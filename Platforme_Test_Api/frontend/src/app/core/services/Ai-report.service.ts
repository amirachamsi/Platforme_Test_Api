import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AiReport } from '../models/models';

@Injectable({ providedIn: 'root' })
export class AiReportService {
  private readonly baseUrl = '/api/aireports';

  constructor(private http: HttpClient) {}

  /** Generates on first call, returns the cached report on subsequent calls — same request either way. */
  generateOrFetch(executionId: number): Observable<AiReport> {
    return this.http.post<AiReport>(`${this.baseUrl}/${executionId}/ai-report`, {});
  }
}