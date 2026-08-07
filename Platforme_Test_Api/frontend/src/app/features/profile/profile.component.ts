import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent {
  username = '';
  email = '';
  role = '';
  password = '';
  confirmationCode = '';
  requestId = '';

  loading = signal(false);
  message = signal<string | null>(null);
  error = signal<string | null>(null);
  confirmationSent = signal(false);

  constructor(private auth: AuthService, private profileService: ProfileService, private router: Router) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.loading.set(true);
    this.profileService.getProfile().subscribe({
      next: (profile) => {
        this.loading.set(false);
        this.email = profile.email;
        this.username = profile.username;
        this.role = profile.role;
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set('Impossible de récupérer le profil.');
      },
    });
  }

  submitUpdate(): void {
    this.error.set(null);
    this.message.set(null);
    if (!this.username && !this.password) {
      this.error.set('Entrez un nouveau nom d’utilisateur ou un nouveau mot de passe.');
      return;
    }

    this.loading.set(true);
    this.profileService.requestProfileUpdate({ username: this.username, password: this.password }).subscribe({
      next: (resp) => {
        this.loading.set(false);
        this.requestId = resp.requestId;
        this.confirmationSent.set(true);
        this.message.set('Un code de confirmation a été envoyé par email. Entrez-le pour valider le changement.');
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error || 'Impossible de démarrer la mise à jour du profil.');
      },
    });
  }

  confirmUpdate(): void {
    this.error.set(null);
    this.message.set(null);
    if (!this.confirmationCode || !this.requestId) {
      this.error.set('Entrez le code de confirmation reçu par email.');
      return;
    }

    this.loading.set(true);
    this.profileService.confirmProfileUpdate({ requestId: this.requestId, verificationCode: this.confirmationCode }).subscribe({
      next: (profile) => {
        this.loading.set(false);
        this.username = profile.username;
        this.message.set('Profil mis à jour avec succès.');
        this.confirmationSent.set(false);
        this.password = '';
        this.confirmationCode = '';
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error || 'Impossible de confirmer la mise à jour.');
      },
    });
  }
}
