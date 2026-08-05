import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface HistoryRow {
  campagne: string;
  correlationId: string;
  date: string;
  duree: string;
  declencheur: string;
  statut: string;
  code: number;
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent {
  selectedReport: HistoryRow | null = null;

  rows: HistoryRow[] = [
    { campagne: 'Test solde — endpoint /balance', correlationId: 'a1f0-92e3', date: '17/07/2026 08:12', duree: '4m 12s', declencheur: 'Manuel', statut: 'REUSSIE', code: 200 },
    { campagne: 'Test virement — endpoint /transfers', correlationId: 'b7c4-11aa', date: '16/07/2026 21:40', duree: '2m 40s', declencheur: 'GitHub Actions', statut: 'ECHOUEE', code: 503 },
    { campagne: 'Smoke test — endpoint /customers', correlationId: 'c93d-4402', date: '16/07/2026 09:05', duree: '38s', declencheur: 'Planifié', statut: 'REUSSIE', code: 200 },
    { campagne: 'Test auth — endpoint /auth/token', correlationId: 'd102-88fe', date: '15/07/2026 17:22', duree: '5m 00s', declencheur: 'Manuel', statut: 'INTERROMPUE', code: 200 },
  ];

  statutClass(statut: string): string {
    switch (statut) {
      case 'REUSSIE': return 's2xx';
      case 'ECHOUEE': return 's5xx';
      case 'EN_COURS': return 's3xx';
      default: return 's4xx';
    }
  }

  codeClass(code: number): string {
    if (code >= 500) return 's5xx';
    if (code >= 400) return 's4xx';
    if (code >= 300) return 's3xx';
    return 's2xx';
  }

  viewReport(row: HistoryRow): void {
    this.selectedReport = row;
  }

  closeReport(): void {
    this.selectedReport = null;
  }

  downloadPdf(row: HistoryRow): void {
    const content = `Rapport de test\n\nTestcase: ${row.campagne}\nID: ${row.correlationId}\nDate: ${row.date}\nStatut: ${row.statut}\nCode: ${row.code}`;
    const blob = new Blob([content], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rapport-${row.correlationId}.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);
  }
}
