import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EndpointService } from '../../core/services/endpoint.service';
import { TestcaseService } from '../../core/services/testcase.service';
import { ApiEndpoint, TestCase, typeStatus } from '../../core/models/models';

interface TestcaseItem {
  id: number;
  endpointId: number;
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

  form = this.emptyForm();

  constructor(
    private endpointService: EndpointService,
    private testcaseService: TestcaseService,
  ) {}

  ngOnInit(): void {
    this.endpointService.list().subscribe({
      next: (endpoints) => this.endpoints = endpoints,
      error: () => this.endpoints = [],
    });
    this.loadTestCases();
  }

  toggleForm(): void {
    this.showForm.set(!this.showForm());
    if (!this.showForm()) this.resetForm();
  }

  editScenario(scenario: TestcaseItem): void {
    this.editingId.set(scenario.id);
    this.form = {
      nom: scenario.nom,
      typeTest: this.getValueKey(scenario.typeTest),
      endpointId: String(scenario.endpointId),
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

    const payload: TestCase = {
      endpoint: { id: endpointId },
      nom: this.form.nom,
      typeStatus: this.toApiTestType(this.form.typeTest),
      seuilMs: Number(this.form.seuilMs),
      timeoutMs: Number(this.form.seuilMs),
    };
    const request$ = this.editingId() === null
      ? this.testcaseService.create(payload)
      : this.testcaseService.update(this.editingId()!, payload);

    request$.subscribe({
      next: () => {
        this.loadTestCases();
        this.showForm.set(false);
        this.resetForm();
      },
    });
  }

  deleteScenario(scenario: TestcaseItem): void {
    this.testcaseService.delete(scenario.id).subscribe({
      next: () => this.scenarios.update((items) => items.filter((item) => item.id !== scenario.id)),
    });
  }

  runScenario(scenario: TestcaseItem): void {
    this.runningId.set(scenario.id);
    this.progress.set(0);
    this.progressLabel.set('Initialisation du test…');

    const interval = window.setInterval(() => {
      const next = Math.min(100, this.progress() + 10);
      this.progress.set(next);
      this.progressLabel.set(next === 100 ? 'Test terminé' : `Test en cours… ${100 - next}% restant`);
      if (next === 100) {
        window.clearInterval(interval);
        this.runningId.set(null);
      }
    }, 400);
  }

  private loadTestCases(): void {
    this.testcaseService.list().subscribe({
      next: (testCases) => this.scenarios.set(testCases.map((testCase) => this.toScenario(testCase))),
      error: () => this.scenarios.set([]),
    });
  }

  private toScenario(testCase: TestCase): TestcaseItem {
    const endpoint = testCase.endpoint as ApiEndpoint;
    return {
      id: testCase.id!,
      endpointId: endpoint.id!,
      nom: testCase.nom,
      typeTest: this.getTestLabelFromApi(testCase.typeStatus),
      endpoint: `${endpoint.methode} ${endpoint.chemin}`,
      codeAttendu: endpoint.codeAttendu ?? 200,
      seuilMs: testCase.seuilMs ?? 0,
      assertions: 'Vérification des règles métier et du statut HTTP.',
      vus: 0,
    };
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.form = this.emptyForm();
  }

  private emptyForm() {
    return { nom: '', typeTest: 'fonctionnel', endpointId: '', preconditions: '', headers: '', donnees: '', vus: 10, codeAttendu: 200, seuilMs: 1000, assertions: '' };
  }

  private toApiTestType(value: string): typeStatus {
    switch (value) {
      case 'charge': return 'CHARGE';
      case 'securite': return 'SECURITE';
      case 'performance': return 'PERFORMANCE';
      default: return 'FONCTIONNEL';
    }
  }

  private getTestLabelFromApi(value?: typeStatus): string {
    switch (value) {
      case 'CHARGE': return 'Charge';
      case 'SECURITE': return 'Sécurité';
      case 'PERFORMANCE': return 'Performance';
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
