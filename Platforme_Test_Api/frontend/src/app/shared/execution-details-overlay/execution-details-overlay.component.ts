 import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExecutionService } from '../../core/services/execution.service';
import { Execution } from '../../core/models/models';

@Component({
  selector: 'app-execution-details-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './execution-details-overlay.component.html',
  styleUrl: './execution-details-overlay.component.scss',
})
export class ExecutionDetailsOverlayComponent implements OnChanges {
  @Input({ required: true }) testCaseId!: number;
  @Input({ required: true }) testCaseNom!: string;
  // Needed to compute the threshold gauges (measured value vs configured limit).
  @Input() seuilMs?: number;
  @Input() tauxErreurMax?: number;
  @Output() closed = new EventEmitter<void>();

  selectedExecution = signal<Execution | null>(null);
  detailsLoading = signal(false);
  detailsError = signal<string | null>(null);
  copyFeedback = signal<string | null>(null);

  constructor(private executionService: ExecutionService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['testCaseId']) {
      this.loadLatest();
    }
  }

  close(): void {
    this.copyFeedback.set(null);
    this.closed.emit();
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
    if (!exec?.p95MesureMs || !this.seuilMs) return 0;
    return Math.min(100, Math.round((exec.p95MesureMs / this.seuilMs) * 100));
  }

  get p95OverLimit(): boolean {
    const exec = this.selectedExecution();
    return !!(exec?.p95MesureMs && this.seuilMs && exec.p95MesureMs > this.seuilMs);
  }

  get errorRateGaugePercent(): number {
    const exec = this.selectedExecution();
    if (exec?.tauxErreurMesure == null || !this.tauxErreurMax) return 0;
    return Math.min(100, Math.round((exec.tauxErreurMesure / this.tauxErreurMax) * 100));
  }

  get errorRateOverLimit(): boolean {
    const exec = this.selectedExecution();
    return !!(exec?.tauxErreurMesure != null && this.tauxErreurMax != null && exec.tauxErreurMesure > this.tauxErreurMax);
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

  private loadLatest(): void {
    this.selectedExecution.set(null);
    this.detailsError.set(null);
    this.detailsLoading.set(true);

    this.executionService.getLatest(this.testCaseId).subscribe({
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
}