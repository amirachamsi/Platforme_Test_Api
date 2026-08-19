
       // on ajoute ce fichier dans lapp.config provideHttpClient(withInterceptors([authInterceptor]))

import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service'; 

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();

  // 1. Cloner la requête et ajouter le header Bearer si le token existe
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  // 2. Traiter la requête et intercepter les erreurs 401
  return next(authReq).pipe(
    catchError((err) => {
      if (err.status === 401 && !req.url.includes('/api/auth/login')) {
        authService.logout(); // Nettoie le sessionStorage et redirige vers /connexion
      }
      return throwError(() => err);
    })
  );
};