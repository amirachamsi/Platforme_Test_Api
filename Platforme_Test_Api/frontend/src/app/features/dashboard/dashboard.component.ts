import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface Kpi { label: string; value: string; trend?: string; tone: 'good' | 'warn' | 'bad' | 'neutral'; }

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  kpis: Kpi[] = [
    { label: 'Testcases (30j)', value: '48', trend: '+6', tone: 'neutral' },
    { label: 'Taux de réussite', value: '96,4 %', trend: '+1,2 pt', tone: 'good' },
    { label: 'p95 temps de réponse', value: '842 ms', trend: '-54 ms', tone: 'good' },
    { label: 'Taux d\'erreur', value: '0,8 %', trend: '+0,1 pt', tone: 'warn' },
  ];

  recentExecutions = [
    { campagne: 'Test solde — endpoint /balance', statut: 'REUSSIE', code: 200, duree: '4m 12s', declencheur: 'Manuel' },
    { campagne: 'Test virement — endpoint /transfers', statut: 'ECHOUEE', code: 503, duree: '2m 40s', declencheur: 'GitHub Actions' },
    { campagne: 'Test auth — endpoint /auth/token', statut: 'EN_COURS', code: 200, duree: '1m 05s', declencheur: 'Manuel' },
    { campagne: 'Smoke test — endpoint /customers', statut: 'REUSSIE', code: 200, duree: '38s', declencheur: 'Planifié' },
  ];

  topApis = [
    { nom: '/accounts/{id}/balance', p95: '1 240 ms', erreurs: '2,1 %' },
    { nom: '/transfers', p95: '980 ms', erreurs: '0,4 %' },
    { nom: '/auth/token', p95: '410 ms', erreurs: '0,1 %' },
  ];

  statusClass(code: number): string {
    if (code >= 500) return 's5xx';
    if (code >= 400) return 's4xx';
    if (code >= 300) return 's3xx';
    return 's2xx';
  }

  statutClass(statut: string): string {
    switch (statut) {
      case 'REUSSIE': return 's2xx';
      case 'ECHOUEE': return 's5xx';
      case 'EN_COURS': return 's3xx';
      default: return 's4xx';
    }
  }
}
