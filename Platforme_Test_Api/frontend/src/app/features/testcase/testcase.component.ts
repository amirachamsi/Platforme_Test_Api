import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EndpointService } from '../../core/services/endpoint.service';
import { TestcaseService } from '../../core/services/testcase.service';
import { ExecutionService } from '../../core/services/execution.service';
import { ApiEndpoint, TestCase, Execution, typeStatus } from '../../core/models/models';

interface TestcaseItem {
  id: number;
  endpointId: number;
  nom: string;
  typeTest: string;
  endpoint: string;
  expectedCode?: string;
  seuilMs?: number;
  tauxErreurMax?: number;
  timeoutMs?: number;
  jsonBody?: string;
  assertions?: string;
  vus?: number;
  dureeSec?: number;
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
  runError = signal<string | null>(null);
  progress = signal(0);
  progressLabel = signal('');
  saving = signal(false);
  error = signal<string | null>(null);

  // --- Details overlay state ---
  showDetails = signal(false);
  selectedScenario = signal<TestcaseItem | null>(null);
  selectedExecution = signal<Execution | null>(null);
  detailsLoading = signal(false);
  detailsError = signal<string | null>(null);
  copyFeedback = signal<string | null>(null);

  form = this.emptyForm();
  private progressIntervalId: number | null = null;

  constructor(
    private endpointService: EndpointService,
    private testcaseService: TestcaseService,
    private executionService: ExecutionService,
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
      expectedCode: scenario.expectedCode ?? '200',
      seuilMs: scenario.seuilMs ?? 1000,
      tauxErreurMax: scenario.tauxErreurMax ?? 5,
      timeoutMs: scenario.timeoutMs ?? 5000,
      jsonBody: scenario.jsonBody ?? '',
      assertions: scenario.assertions ?? '',
      vus: scenario.vus ?? 1,
      dureeSec: scenario.dureeSec ?? 10,
    };
    this.showForm.set(true);
  }

  submit(): void {
    const endpointId = Number(this.form.endpointId);
    if (!this.form.nom || !endpointId) {
      this.error.set('Veuillez renseigner au minimum le nom du scénario et un endpoint.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    // Note: `teststatus` est volontairement omis — il est géré côté backend
    // (valeur par défaut EN_ATTENTE, puis mis à jour par les exécutions).
    const payload: TestCase = {
      endpoint: { id: endpointId },
      nom: this.form.nom,
      typeStatus: this.toApiTestType(this.form.typeTest),
      expectedCode: this.form.expectedCode,
      seuilMs: Number(this.form.seuilMs),
      tauxErreurMax: Number(this.form.tauxErreurMax),
      timeoutMs: Number(this.form.timeoutMs),
      JSONBody: this.form.jsonBody,
      assertions: this.form.assertions,
      vus: Number(this.form.vus),
      dureeSec: Number(this.form.dureeSec),
    };
    const request$ = this.editingId() === null
      ? this.testcaseService.create(payload)
      : this.testcaseService.update(this.editingId()!, payload);

    request$.subscribe({
      next: () => {
        this.loadTestCases();
        this.showForm.set(false);
        this.resetForm();
        this.saving.set(false);
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Impossible d’enregistrer le scénario dans la base. Vérifiez le backend puis réessayez.');
      },
    });
  }

  deleteScenario(scenario: TestcaseItem): void {
    this.testcaseService.delete(scenario.id).subscribe({
      next: () => this.scenarios.update((items) => items.filter((item) => item.id !== scenario.id)),
    });
  }

  /**
   * Blocking: the HTTP call doesn't resolve until k6 finishes, so there's no
   * real incremental progress from the server. Instead the bar is simulated
   * client-side against the scenario's configured duration, capped just under
   * 100% so it never falsely claims "done" before the response actually
   * arrives, then snaps to 100% once it does.
   */
  runScenario(scenario: TestcaseItem, event?: Event): void {
    event?.stopPropagation();
    this.runningId.set(scenario.id);
    this.runError.set(null);
    this.startProgressSimulation(scenario.dureeSec ?? 10);

    this.executionService.execute(scenario.id).subscribe({
      next: (execution) => {
        this.finishProgress(() => {
          this.runningId.set(null);
          this.selectedScenario.set(scenario);
          this.selectedExecution.set(execution);
          this.detailsError.set(null);
          this.showDetails.set(true);
        });
      },
      error: () => {
        this.finishProgress(() => {
          this.runningId.set(null);
          this.runError.set(`Échec de l'exécution du scénario "${scenario.nom}".`);
        });
      },
    });
  }

  private startProgressSimulation(durationSec: number): void {
    this.progress.set(0);
    this.progressLabel.set('Initialisation du test…');

    const totalMs = durationSec * 1000;
    const startedAt = Date.now();
    const maxSimulatedPct = 92; // reserve the last stretch for the real response

    this.clearProgressInterval();
    this.progressIntervalId = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const ratio = Math.min(elapsed / totalMs, 1);
      this.progress.set(Math.round(ratio * maxSimulatedPct));

      if (elapsed < totalMs) {
        const remaining = Math.max(0, Math.ceil((totalMs - elapsed) / 1000));
        this.progressLabel.set(`Test en cours… ~${remaining}s restantes`);
      } else {
        this.progressLabel.set('Finalisation des résultats…');
      }
    }, 250);
  }

  /** Snaps the bar to 100% briefly so the user sees completion, then runs the given callback. */
  private finishProgress(then: () => void): void {
    this.clearProgressInterval();
    this.progress.set(100);
    this.progressLabel.set('Terminé');
    window.setTimeout(then, 400);
  }

  private clearProgressInterval(): void {
    if (this.progressIntervalId !== null) {
      window.clearInterval(this.progressIntervalId);
      this.progressIntervalId = null;
    }
  }

  /** Opens the details overlay and fetches the latest execution for this scenario, if any. */
  openDetails(scenario: TestcaseItem): void {
    this.selectedScenario.set(scenario);
    this.selectedExecution.set(null);
    this.detailsError.set(null);
    this.detailsLoading.set(true);
    this.showDetails.set(true);

    this.executionService.getLatest(scenario.id).subscribe({
      next: (execution) => {
        this.selectedExecution.set(execution);
        this.detailsLoading.set(false);
      },
      error: () => {
        this.detailsError.set('Impossible de récupérer les résultats d’exécution.');
        this.detailsLoading.set(false);
      },
    });
  }

  closeDetails(): void {
    this.showDetails.set(false);
    this.selectedScenario.set(null);
    this.selectedExecution.set(null);
    this.detailsError.set(null);
    this.copyFeedback.set(null);
  }

  copyRawReport(event: Event): void {
    // <details>/<summary> would otherwise toggle open/closed on this click too.
    event.preventDefault();
    event.stopPropagation();

    const raw = this.selectedExecution()?.rapportK6Json;
    if (!raw) return;

    navigator.clipboard.writeText(raw).then(
      () => {
        this.copyFeedback.set('Copié !');
        window.setTimeout(() => this.copyFeedback.set(null), 1500);
      },
      () => {
        this.copyFeedback.set('Échec de la copie');
        window.setTimeout(() => this.copyFeedback.set(null), 1500);
      },
    );
  }

  // --- Derived values for the results overlay visuals ---

  readonly donutCircumference = 2 * Math.PI * 42;

  get executionSuccessPercent(): number {
    const exec = this.selectedExecution();
    if (!exec?.reqTotal) return 0;
    return ((exec.reqReussies ?? 0) / exec.reqTotal) * 100;
  }

  get donutSuccessOffset(): number {
    return this.donutCircumference * (1 - this.executionSuccessPercent / 100);
  }

  get p95GaugePercent(): number {
    const exec = this.selectedExecution();
    const seuil = this.selectedScenario()?.seuilMs;
    if (!exec?.p95MesureMs || !seuil) return 0;
    return Math.min(100, Math.round((exec.p95MesureMs / seuil) * 100));
  }

  get p95OverLimit(): boolean {
    const exec = this.selectedExecution();
    const seuil = this.selectedScenario()?.seuilMs;
    return !!(exec?.p95MesureMs && seuil && exec.p95MesureMs > seuil);
  }

  get errorRateGaugePercent(): number {
    const exec = this.selectedExecution();
    const max = this.selectedScenario()?.tauxErreurMax;
    if (exec?.tauxErreurMesure == null || !max) return 0;
    return Math.min(100, Math.round((exec.tauxErreurMesure / max) * 100));
  }

  get errorRateOverLimit(): boolean {
    const exec = this.selectedExecution();
    const max = this.selectedScenario()?.tauxErreurMax;
    return !!(exec?.tauxErreurMesure != null && max != null && exec.tauxErreurMesure > max);
  }

  /**
   * Extracts the "actual status observed: NNN" diagnostic checks from the raw
   * k6 report and turns them into a {code, count} histogram, sorted by
   * frequency. testcase-runner.js adds one such check per distinct status
   * code it saw, with `passes` equal to how many requests returned it.
   */
  get observedStatusCodes(): { code: string; count: number }[] {
    const raw = this.selectedExecution()?.rapportK6Json;
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      const checks: any[] = parsed?.root_group?.checks ?? [];
      const prefix = 'actual status observed: ';

      return checks
        .filter((c) => typeof c?.name === 'string' && c.name.startsWith(prefix))
        .map((c) => ({ code: c.name.slice(prefix.length), count: c.passes ?? 0 }))
        .sort((a, b) => b.count - a.count);
    } catch {
      return [];
    }
  }

  statusCodeLabel(code: string): string {
    return code === '0' ? 'Aucune réponse' : code;
  }

  statusCodeClass(code: string): string {
    const n = Number(code);
    if (n >= 200 && n < 300) return 'status-code-2xx';
    if (n >= 300 && n < 400) return 'status-code-3xx';
    if (n >= 400 && n < 500) return 'status-code-4xx';
    if (n >= 500) return 'status-code-5xx';
    return 'status-code-other';
  }

  /** Parses corpsReponsesJson, already merged/sorted server-side — see K6ResultParser. */
  get responseBodyVariants(): { preview: string; count: number }[] {
    const raw = this.selectedExecution()?.corpsReponsesJson;
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
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
      expectedCode: testCase.expectedCode ?? (endpoint.codeAttendu != null ? String(endpoint.codeAttendu) : '200'),
      seuilMs: testCase.seuilMs ?? 0,
      tauxErreurMax: testCase.tauxErreurMax,
      timeoutMs: testCase.timeoutMs,
      jsonBody: testCase.JSONBody,
      assertions: testCase.assertions,
      vus: testCase.vus ?? 1,
      dureeSec: testCase.dureeSec ?? 10,
    };
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.form = this.emptyForm();
  }

  private emptyForm() {
    return {
      nom: '',
      typeTest: 'fonctionnel',
      endpointId: '',
      expectedCode: '200',
      seuilMs: 1000,
      tauxErreurMax: 5,
      timeoutMs: 5000,
      jsonBody: '',
      assertions: '',
      vus: 1,
      dureeSec: 10,
    };
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