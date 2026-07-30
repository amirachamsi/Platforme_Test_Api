import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  // TODO: réactiver l'authentification — désactivée temporairement pour tester
  // le reste de l'app sans passer par l'écran de connexion.
  // Pour réactiver, remettre le code ci-dessous :
  //
  // const auth = inject(AuthService);
  // const router = inject(Router);
  // if (auth.isAuthenticated()) return true;
  // router.navigate(['/connexion']);
  // return false;

  return true;
};