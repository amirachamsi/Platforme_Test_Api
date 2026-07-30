import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  navItems = [
    { path: 'tableau-de-bord', label: 'Tableau de bord', icon: 'grid' },
    { path: 'cibles', label: 'Cibles & API', icon: 'target' },
    { path: 'campagnes', label: 'Campagnes', icon: 'play-circle' },
    { path: 'scenarios-de-test', label: 'Scénarios de test', icon: 'check-circle' },
    { path: 'historique', label: 'Historique', icon: 'clock' },
  ];

  constructor(public auth: AuthService) {}
}
