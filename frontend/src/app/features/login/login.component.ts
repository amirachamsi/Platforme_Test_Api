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
  identifiant = '';
  motDePasse = '';
  loading = signal(false);
  error = signal<string | null>(null);

  constructor(private auth: AuthService, private router: Router) {}

  submit(): void {
    if (!this.identifiant || !this.motDePasse) return;
    this.loading.set(true);
    this.error.set(null);
    this.auth.login(this.identifiant, this.motDePasse).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/tableau-de-bord']);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Identifiant ou mot de passe incorrect.');
      },
    });
  }
}
