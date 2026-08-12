import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Campaign, CampaignLaunch, CampaignRequest } from '../models/models';

@Injectable({ providedIn: 'root' })
export class CampaignService {
  private readonly baseUrl = '/api/campaigns';

  constructor(private http: HttpClient) {}

  list(): Observable<Campaign[]> {
    return this.http.get<Campaign[]>(this.baseUrl);
  }

  getById(id: number): Observable<Campaign> {
    return this.http.get<Campaign>(`${this.baseUrl}/${id}`);
  }

  create(request: CampaignRequest): Observable<Campaign> {
    return this.http.post<Campaign>(this.baseUrl, request);
  }

  update(id: number, request: CampaignRequest): Observable<Campaign> {
    return this.http.put<Campaign>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /** Just timestamps the launch server-side; actual executions are fired separately per test case. */
  launch(id: number): Observable<Campaign> {
    return this.http.post<Campaign>(`${this.baseUrl}/${id}/launch`, {});
  }

  /** Full launch history across every campaign, newest first — for the History page. */
  getLaunchHistory(): Observable<CampaignLaunch[]> {
    return this.http.get<CampaignLaunch[]>(`${this.baseUrl}/launches`);
  }
}