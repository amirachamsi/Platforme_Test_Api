import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ApiEndpoint } from '../../core/models/models';

interface TestcaseItem {
  id: number;
  nom: string;
  typeTest: string;
  endpoint: string;
  codeAttendu: number;
  seuilMs: number;
  assertions: string;
  preconditions?: string;
  headers?: string;
  donnees?: string;
  vus?: number;
}

@Component({
  selector: 'app-testcase',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './testcase.component.html',
  styleUrl: './testcase.component.scss',
})
export class TestcaseComponent implements OnInit {
  scenarios = signal<TestcaseItem[]>([]);
  showForm = signal(false);
  endpoints: ApiEndpoint[] = [];
  editingId = signal<number | null>(null);
  runningId = signal<number | null>(null);
  progress = signal(0);
  progressLabel = signal('Prêt');

  form = {
    nom: '',
    typeTest: 'fonctionnel',
    endpointId: '',
    preconditions: '',
    headers: '',
    donnees: '',
    vus: 10,
    codeAttendu: 200,
    seuilMs: 1000,
    assertions: '',
  };

  private readonly demoEndpoints: ApiEndpoint[] = [
    { id: 1, target: { id: 1 }, nom: 'Vérification solde', methode: 'GET', chemin: '/api/clients/solde' },
    { id: 2, target: { id: 1 }, nom: 'Création de virement', methode: 'POST', chemin: '/api/virements' },
    { id: 3, target: { id: 1 }, nom: 'Consultation historique', methode: 'GET', chemin: '/api/operations/historique' },
  ];

  private readonly demoScenarios: TestcaseItem[] = [
    {
      id: 1,
      nom: 'Scénario solde',
      typeTest: 'Fonctionnel',
      endpoint: 'GET /api/clients/solde',
      codeAttendu: 200,
      seuilMs: 800,
      assertions: 'Vérification du statut 200 et du contenu du payload.',
      preconditions: 'Le compte doit être actif et avoir un solde de référence.',
      headers: '{ "Content-Type": "application/json" }',
      donnees: '{ "compte": "ACC-001" }',
      vus: 10,
    },
    {
      id: 2,
      nom: 'Scénario virement',
      typeTest: 'Sécurité',
      endpoint: 'POST /api/virements',
      codeAttendu: 201,
      seuilMs: 1200,
      assertions: 'Validation des permissions et du format des données.',
      preconditions: 'Le bénéficiaire doit être enregistré et le montant doit être positif.',
      headers: '{ "Content-Type": "application/json", "X-Correlation-ID": "12345" }',
      donnees: '{ "compteSource": "ACC-001", "compteCible": "ACC-002", "montant": 150.0 }',
      vus: 25,
    },
  ];

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.listEndpoints().subscribe({
      next: (data) => {
        this.endpoints = data.length ? data : this.demoEndpoints;
        this.scenarios.set(this.demoScenarios);
      },
      error: () => {
        this.endpoints = this.demoEndpoints;
        this.scenarios.set(this.demoScenarios);
      },
    });
  }

  toggleForm(): void {
    this.showForm.set(!this.showForm());
    if (!this.showForm()) {
      this.resetForm();
    }
  }

  editScenario(scenario: TestcaseItem): void {
    this.editingId.set(scenario.id);
    this.form = {
      nom: scenario.nom,
      typeTest: this.getValueKey(scenario.typeTest),
      endpointId: '',
      preconditions: scenario.preconditions ?? '',
      headers: scenario.headers ?? '',
      donnees: scenario.donnees ?? '',
      vus: scenario.vus ?? 10,
      codeAttendu: scenario.codeAttendu,
      seuilMs: scenario.seuilMs,
      assertions: scenario.assertions,
    };
    this.showForm.set(true);
  }

  submit(): void {
    const endpointId = Number(this.form.endpointId);
    if (!this.form.nom || !endpointId) return;

    const endpoint = this.endpoints.find((item) => item.id === endpointId);
    const nextScenario: TestcaseItem = {
      id: this.editingId() ?? Date.now(),
      nom: this.form.nom,
      typeTest: this.getTestLabel(this.form.typeTest),
      endpoint: endpoint ? `${endpoint.methode} ${endpoint.chemin}` : `Endpoint #${endpointId}`,
      codeAttendu: Number(this.form.codeAttendu),
      seuilMs: Number(this.form.seuilMs),
      assertions: this.form.assertions || 'Vérification des règles métier et du statut HTTP.',
      preconditions: this.form.preconditions || undefined,
      headers: this.form.headers || undefined,
      donnees: this.form.donnees || undefined,
      vus: Number(this.form.vus || 0),
    };

    if (this.editingId() !== null) {
      this.scenarios.update((list) => list.map((item) => item.id === nextScenario.id ? nextScenario : item));
    } else {
      this.scenarios.set([nextScenario, ...this.scenarios()]);
    }

    this.showForm.set(false);
    this.resetForm();
  }

  deleteScenario(scenario: TestcaseItem): void {
    this.scenarios.set(this.scenarios().filter((item) => item.id !== scenario.id));
  }

  runScenario(scenario: TestcaseItem): void {
    this.runningId.set(scenario.id);
    this.progress.set(0);
    this.progressLabel.set('Initialisation du test…');

    const interval = window.setInterval(() => {
      const current = this.progress();
      if (current >= 100) {
        window.clearInterval(interval);
        this.progress.set(100);
        this.progressLabel.set('Test terminé');
        this.runningId.set(null);
        return;
      }

      const next = Math.min(100, current + 10);
      this.progress.set(next);
      this.progressLabel.set(`Test en cours… ${100 - next}% restant`);
    }, 400);
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.form = {
      nom: '',
      typeTest: 'fonctionnel',
      endpointId: '',
      preconditions: '',
      headers: '',
      donnees: '',
      vus: 10,
      codeAttendu: 200,
      seuilMs: 1000,
      assertions: '',
    };
  }

  private getTestLabel(value: string): string {
    switch (value) {
      case 'charge': return 'Charge';
      case 'securite': return 'Sécurité';
      case 'performance': return 'Performance';
      default: return 'Fonctionnel';
    }
  }

  private getValueKey(label: string): string {
    switch (label) {
      case 'Charge': return 'charge';
      case 'Sécurité': return 'securite';
      case 'Performance': return 'performance';
      default: return 'fonctionnel';
    }
  }
}
