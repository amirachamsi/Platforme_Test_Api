import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

interface LoginResponse {
  token: string;
  role: string;
  identifiant?: string;
  email?: string;
  expiresInMinutes?: number;
}

const TOKEN_KEY = 'bct_apitest_token';
const USER_KEY = 'bct_apitest_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  currentUser = signal<string | null>(sessionStorage.getItem(USER_KEY));

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>('/api/auth/login', { email, password }).pipe(
      tap((res) => {
        const userIdentifier = res.identifiant ?? res.email ?? email;
        sessionStorage.setItem(TOKEN_KEY, res.token);
        sessionStorage.setItem(USER_KEY, userIdentifier);
        this.currentUser.set(userIdentifier);
      })
    );
  }

  logout(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/connexion']);
  }

  getToken(): string | null {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}
