import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
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

  /** Deletes one saved execution from the backend history. */
  delete(id: number): Observable<Execution[]> {
    return this.http.delete<Execution[]>(`${this.baseUrl}/delete/${id}`);
  }

  /** Deletes the complete execution history from the backend. */
  deleteAll(): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/delete/all`);
  }

  /**
   * Downloads (or opens) the HTML performance report for an execution.
   * @param openInNewTab when true, opens the report instead of forcing a file download.
   */
  downloadReport(executionId: number, fileName?: string, openInNewTab = false): Observable<Blob> {
    const disposition = openInNewTab ? 'inline' : 'attachment';
    return this.http
      .get(`${this.baseUrl}/${executionId}/rapport`, {
        responseType: 'blob',
        params: { disposition },
      })
      .pipe(
        tap((blob) => {
          const url = URL.createObjectURL(blob);
          if (openInNewTab) {
            window.open(url, '_blank', 'noopener');
            // Revoke later so the new tab can still load the blob.
            window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
            return;
          }
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = fileName ?? `rapport-execution-${executionId}.html`;
          anchor.click();
          URL.revokeObjectURL(url);
        }),
      );
  }
}
