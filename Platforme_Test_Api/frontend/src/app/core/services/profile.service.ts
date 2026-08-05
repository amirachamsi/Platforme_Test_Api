import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

interface ProfileResponse {
  email: string;
  username: string;
  role: string;
}

interface ProfileUpdateRequest {
  username?: string;
  password?: string;
}

interface ProfileUpdateInitiationResponse {
  requestId: string;
  expiresInMinutes: number;
}

interface ConfirmProfileUpdateRequest {
  requestId: string;
  verificationCode: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  constructor(private http: HttpClient) {}

  getProfile(): Observable<ProfileResponse> {
    return this.http.get<ProfileResponse>('/api/auth/me');
  }

  requestProfileUpdate(request: ProfileUpdateRequest): Observable<ProfileUpdateInitiationResponse> {
    return this.http.post<ProfileUpdateInitiationResponse>('/api/auth/profile/request-update', request);
  }

  confirmProfileUpdate(request: ConfirmProfileUpdateRequest): Observable<ProfileResponse> {
    return this.http.post<ProfileResponse>('/api/auth/profile/confirm-update', request);
  }
}
