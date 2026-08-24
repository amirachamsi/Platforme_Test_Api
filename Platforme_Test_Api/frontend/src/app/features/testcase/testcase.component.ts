import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EndpointService } from '../../core/services/endpoint.service';
import { TestcaseService } from '../../core/services/testcase.service';
import { ExecutionService } from '../../core/services/execution.service';
import { ApiEndpoint, TestCase, Execution, ExecutionMode, typeStatus } from '../../core/models/models';
import { ExecutionDetailsOverlayComponent } from '../../shared/execution-details-overlay/execution-details-overlay.component';

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
  executionMode?: ExecutionMode;
  nombreRequetes?: number;
}

@Component({
  selector: 'app-testcase',
  standalone: true,
  imports: [CommonModule, FormsModule, ExecutionDetailsOverlayComponent],
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
  progressIndeterminate = signal(false);
  progressIsEstimate = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  jsonBodyError = signal<string | null>(null);
  showDeleteConfirm = signal(false);
  deleteConfirmTitle = signal('');
  deleteConfirmMessage = signal('');
  deleteConfirmActionLabel = signal('Supprimer');

  // --- Details overlay: just tracks which scenario is selected; the shared
  // component fetches/renders everything else from its @Input()s.
  showDetails = signal(false);
  selectedScenario = signal<TestcaseItem | null>(null);

  form = this.emptyForm();
  private progressIntervalId: number | null = null;
  private pendingDeleteAction: (() => void) | null = null;

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

  openForm(): void {
    this.editingId.set(null);
    this.error.set(null);
    this.jsonBodyError.set(null);
    this.form = this.emptyForm();
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.error.set(null);
    this.jsonBodyError.set(null);
    this.resetForm();
  }

  editScenario(scenario: TestcaseItem): void {
    this.editingId.set(scenario.id);
    this.error.set(null);
    this.jsonBodyError.set(null);
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
      executionMode: scenario.executionMode ?? 'DUREE',
      nombreRequetes: scenario.nombreRequetes ?? 100,
    };
    this.showForm.set(true);
  }

  submit(): void {
    const endpointId = Number(this.form.endpointId);
    if (!this.form.nom || !endpointId) {
      this.error.set('Veuillez renseigner au minimum le nom du scénario et un endpoint.');
      return;
    }

    const jsonBody = this.form.jsonBody.trim();
    if (!this.validateJsonBody()) {
      this.error.set('Le corps JSON doit être un JSON valide.');
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
      JSONBody: jsonBody,
      assertions: this.form.assertions,
      vus: Number(this.form.vus),
      dureeSec: Number(this.form.dureeSec),
      executionMode: this.form.executionMode,
      nombreRequetes: Number(this.form.nombreRequetes),
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
    this.openDeleteConfirm(
      'Supprimer le scenario',
      `Voulez-vous vraiment supprimer le scenario "${scenario.nom}" ?`,
      () => this.performDeleteScenario(scenario),
      'Supprimer le scenario',
    );
  }

  private performDeleteScenario(scenario: TestcaseItem): void {
    this.closeDeleteConfirm();
    this.testcaseService.delete(scenario.id).subscribe({
      next: () => this.scenarios.update((items) => items.filter((item) => item.id !== scenario.id)),
    });
  }

  /**
   * Blocking: the HTTP call doesn't resolve until k6 finishes, so there's no
   * real incremental progress from the server. In DUREE mode the bar is
   * simulated against the scenario's configured duration — a value we know
   * for certain. In REQUETES mode we don't know the real duration up front
   * (it depends on how fast the target responds), so we estimate it from the
   * previous execution's measured throughput (nombreRequetes / rpsMoyen) and
   * clearly label it as an estimate; with no prior execution to estimate
   * from, the bar falls back to an indeterminate pulsing state instead of
   * showing a made-up percentage.
   */
  runScenario(scenario: TestcaseItem, event?: Event): void {
    event?.stopPropagation();
    this.runningId.set(scenario.id);
    this.runError.set(null);

    if (scenario.executionMode === 'REQUETES') {
      this.executionService.getLatest(scenario.id).subscribe({
        next: (lastExecution) => {
          const estimatedSeconds = this.estimateRequestModeDuration(scenario, lastExecution);
          this.startProgressSimulation(estimatedSeconds, true);
          this.launchExecution(scenario);
        },
        error: () => {
          this.startProgressSimulation(null, true);
          this.launchExecution(scenario);
        },
      });
    } else {
      this.startProgressSimulation(scenario.dureeSec ?? 10, false);
      this.launchExecution(scenario);
    }
  }

  private estimateRequestModeDuration(scenario: TestcaseItem, lastExecution: Execution | null): number | null {
    const target = scenario.nombreRequetes ?? 0;
    const previousRps = lastExecution?.rpsMoyen;
    if (!target || !previousRps || previousRps <= 0) return null;
    return target / previousRps;
  }

  private launchExecution(scenario: TestcaseItem): void {
    this.executionService.execute(scenario.id).subscribe({
      next: () => {
        this.finishProgress(() => {
          this.runningId.set(null);
          this.openDetails(scenario);
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

  /**
   * durationSec === null → indeterminate mode: no percentage, just an elapsed-time
   * counter, since we have nothing to estimate against.
   * isEstimate → durationSec is a guess (REQUETES mode from prior throughput), so
   * the label says so explicitly rather than implying a known value.
   */
  private startProgressSimulation(durationSec: number | null, isEstimate: boolean): void {
    this.progress.set(0);
    this.progressIsEstimate.set(isEstimate);
    this.progressIndeterminate.set(durationSec === null);

    const startedAt = Date.now();
    this.clearProgressInterval();

    if (durationSec === null) {
      this.progressLabel.set('Test en cours… (durée non estimable)');
      this.progressIntervalId = window.setInterval(() => {
        const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
        this.progressLabel.set(`Test en cours depuis ${elapsedSec}s… (durée non estimable)`);
      }, 1000);
      return;
    }

    const totalMs = durationSec * 1000;
    const maxSimulatedPct = 92; // reserve the last stretch for the real response
    const suffix = isEstimate ? ' (estimation)' : '';

    this.progressLabel.set('Initialisation du test…');
    this.progressIntervalId = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const ratio = Math.min(elapsed / totalMs, 1);
      this.progress.set(Math.round(ratio * maxSimulatedPct));

      if (elapsed < totalMs) {
        const remaining = Math.max(0, Math.ceil((totalMs - elapsed) / 1000));
        this.progressLabel.set(`Test en cours… ~${remaining}s restantes${suffix}`);
      } else {
        this.progressLabel.set(`Finalisation des résultats…${suffix}`);
      }
    }, 250);
  }

  /** Snaps the bar to 100% briefly so the user sees completion, then runs the given callback. */
  private finishProgress(then: () => void): void {
    this.clearProgressInterval();
    this.progressIndeterminate.set(false);
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

  openDetails(scenario: TestcaseItem): void {
    this.selectedScenario.set(scenario);
    this.showDetails.set(true);
  }

  closeDetails(): void {
    this.showDetails.set(false);
    this.selectedScenario.set(null);
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
      executionMode: testCase.executionMode ?? 'DUREE',
      nombreRequetes: testCase.nombreRequetes ?? 100,
    };
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.jsonBodyError.set(null);
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
      executionMode: 'DUREE' as ExecutionMode,
      nombreRequetes: 100,
    };
  }

  /** GET/DELETE endpoints have no meaningful request body — hides the field entirely
   * rather than just disabling it, once an endpoint is actually selected. */
  get showBodyField(): boolean {
    const methode = this.selectedEndpointMethod;
    return methode !== 'GET' && methode !== 'DELETE';
  }

  private get selectedEndpointMethod(): string | null {
    const id = Number(this.form.endpointId);
    if (!id) return null;
    return this.endpoints.find((e) => e.id === id)?.methode ?? null;
  }

  /** Groups endpoints by their target (name + base URL) so the dropdown shows
   * which API each endpoint belongs to, instead of a flat unlabeled list. */
  get groupedEndpoints(): { targetId: number; label: string; endpoints: ApiEndpoint[] }[] {
    const groups = new Map<number, { targetId: number; label: string; endpoints: ApiEndpoint[] }>();
    for (const ep of this.endpoints) {
      const target = ep.target as any;
      const targetId = target?.id ?? 0;
      const label = target?.nom ? `${target.nom} — ${target.urlBase ?? ''}` : 'Cible inconnue';
      if (!groups.has(targetId)) {
        groups.set(targetId, { targetId, label, endpoints: [] });
      }
      groups.get(targetId)!.endpoints.push(ep);
    }
    return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));
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

  onJsonBodyChange(): void {
    this.validateJsonBody();
  }

  prettifyJsonBody(): void {
    if (!this.validateJsonBody()) {
      return;
    }
    const value = this.form.jsonBody.trim();
    if (!value) {
      return;
    }
    this.form.jsonBody = JSON.stringify(JSON.parse(value), null, 2);
  }

  private validateJsonBody(): boolean {
    const value = this.form.jsonBody.trim();
    if (!value || !this.showBodyField) {
      if (this.selectedEndpointMethod === 'POST') {
        this.jsonBodyError.set('Le body est obligatoire pour une requete POST.');
        return false;
      }
      this.jsonBodyError.set(null);
      return true;
    }

    try {
      JSON.parse(value);
      this.jsonBodyError.set(null);
      return true;
    } catch (error: any) {
      this.jsonBodyError.set(error?.message || 'JSON invalide.');
      return false;
    }
  }

  private isValidJson(value: string): boolean {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }

  openDeleteConfirm(title: string, message: string, action: () => void, actionLabel = 'Supprimer'): void {
    this.deleteConfirmTitle.set(title);
    this.deleteConfirmMessage.set(message);
    this.deleteConfirmActionLabel.set(actionLabel);
    this.pendingDeleteAction = action;
    this.showDeleteConfirm.set(true);
  }

  closeDeleteConfirm(): void {
    this.showDeleteConfirm.set(false);
    this.pendingDeleteAction = null;
  }

  confirmDelete(): void {
    const action = this.pendingDeleteAction;
    if (!action) {
      this.closeDeleteConfirm();
      return;
    }
    action();
  }
}