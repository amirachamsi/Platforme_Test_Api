import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  // Renommé pour clarté avec le backend
  email = '';
  password = '';
  
  loading = signal(false);
  error = signal<string | null>(null);

  constructor(private auth: AuthService, private router: Router) {}

  submit(): void {
    if (!this.email || !this.password) {
      this.error.set('Veuillez remplir tous les champs.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/tableau-de-bord']);
      },
      error: (err) => {
        this.loading.set(false);
        const message = err?.error && typeof err.error === 'string'
          ? err.error
          : err?.status === 401
            ? 'Email ou mot de passe incorrect.'
            : err?.status === 403
              ? 'Accès refusé. Vérifiez la configuration du serveur.'
              : 'Une erreur est survenue lors de la connexion.';
        this.error.set(message);
      },
    });
  }
}