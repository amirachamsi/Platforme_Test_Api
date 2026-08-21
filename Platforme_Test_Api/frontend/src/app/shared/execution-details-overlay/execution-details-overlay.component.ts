import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExecutionService } from '../../core/services/execution.service';
import { AiReportService } from '../../core/services/Ai-report.service';
import { AiReport, Execution } from '../../core/models/models';

@Component({
  selector: 'app-execution-details-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './execution-details-overlay.component.html',
  styleUrl: './execution-details-overlay.component.scss',
})
export class ExecutionDetailsOverlayComponent implements OnChanges {
  // Either provide testCaseId (fetches that test case's latest execution —
  // used by the TestCase/Campaign pages) OR provide execution directly (a
  // specific past run — used by the History page, where "latest" would be
  // wrong for anything but the newest row).
  @Input() testCaseId?: number;
  @Input() execution?: Execution | null;
  @Input({ required: true }) testCaseNom!: string;
  // Needed to compute the threshold gauges (measured value vs configured limit).
  @Input() seuilMs?: number;
  @Input() tauxErreurMax?: number;
  @Output() closed = new EventEmitter<void>();

  selectedExecution = signal<Execution | null>(null);
  detailsLoading = signal(false);
  detailsError = signal<string | null>(null);
  copyFeedback = signal<string | null>(null);
  downloadFeedback = signal<string | null>(null);
  downloadLoading = signal(false);

  // --- AI report state ---
  aiReport = signal<AiReport | null>(null);
  aiReportVisible = signal(false);
  aiReportLoading = signal(false);
  aiReportError = signal<string | null>(null);

  constructor(
    private executionService: ExecutionService,
    private aiReportService: AiReportService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['execution']) {
      this.selectedExecution.set(this.execution ?? null);
      this.detailsLoading.set(false);
      this.detailsError.set(null);
      this.resetAiReport();
    } else if (changes['testCaseId'] && this.testCaseId != null) {
      this.resetAiReport();
      this.loadLatest();
    }
  }

  close(): void {
    this.copyFeedback.set(null);
    this.downloadFeedback.set(null);
    this.closed.emit();
  }

  openReport(): void {
    this.fetchReport(true);
  }

  downloadReportFile(): void {
    this.fetchReport(false);
  }

  private fetchReport(openInNewTab: boolean): void {
    const exec = this.selectedExecution();
    if (!exec?.id || this.downloadLoading()) return;

    this.downloadLoading.set(true);
    this.downloadFeedback.set(null);
    const safeName = (this.testCaseNom || 'execution')
      .replace(/[^\w\-]+/g, '_')
      .slice(0, 40);
    this.executionService
      .downloadReport(exec.id, `rapport-${safeName}-${exec.id}.html`, openInNewTab)
      .subscribe({
        next: () => {
          this.downloadLoading.set(false);
          this.downloadFeedback.set(openInNewTab ? 'Ouvert' : 'Téléchargé');
          window.setTimeout(() => this.downloadFeedback.set(null), 1500);
        },
        error: () => {
          this.downloadLoading.set(false);
          this.downloadFeedback.set('Échec du rapport');
          window.setTimeout(() => this.downloadFeedback.set(null), 2000);
        },
      });
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

  // --- AI report ---

  generateAiReport(): void {
    const execution = this.selectedExecution();
    if (!execution?.id) return;

    // Already cached client-side from this session — just reveal it.
    if (this.aiReport()) {
      this.aiReportVisible.set(true);
      return;
    }

    this.aiReportLoading.set(true);
    this.aiReportError.set(null);

    this.aiReportService.generateOrFetch(execution.id).subscribe({
      next: (report) => {
        this.aiReport.set(report);
        this.aiReportLoading.set(false);
        this.aiReportVisible.set(true);
      },
      error: () => {
        this.aiReportError.set("Impossible de générer le rapport IA. Vérifiez la configuration de la clé API côté serveur.");
        this.aiReportLoading.set(false);
      },
    });
  }

  aiReportList(json?: string): string[] {
    if (!json) return [];
    try {
      return JSON.parse(json);
    } catch {
      return [];
    }
  }

  aiSeverityClass(severity?: string): string {
    switch (severity) {
      case 'FAIBLE': return 'severity-low';
      case 'ELEVE': return 'severity-high';
      default: return 'severity-medium';
    }
  }

  downloadAiReport(): void {
    const report = this.aiReport();
    if (!report) return;

    const strengths = this.aiReportList(report.strengthsJson);
    const risks = this.aiReportList(report.risksJson);
    const recommendations = this.aiReportList(report.recommendationsJson);
    const severity = report.severity ?? 'N/A';
    const severityClass = this.aiSeverityClass(report.severity);

    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const listBlock = (title: string, items: string[]) =>
      items.length
        ? `<section><h2>${title}</h2><ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></section>`
        : '';

    const generatedAt = report.generatedAt
      ? new Date(report.generatedAt).toLocaleString('fr-FR')
      : null;

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Rapport IA — ${esc(this.testCaseNom)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #0d2447; max-width: 760px; margin: 40px auto; padding: 0 24px; line-height: 1.6; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .meta { color: #6b7a99; font-size: 13px; margin-bottom: 20px; }
  .severity-chip { display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 24px; }
  .severity-low { background: rgba(30,166,114,0.14); color: #0f7a4a; }
  .severity-medium { background: rgba(217,155,21,0.14); color: #a06a0a; }
  .severity-high { background: rgba(212,63,63,0.12); color: #d43f3f; }
  section { margin-bottom: 24px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.03em; color: #6b7a99; margin: 0 0 8px; border-bottom: 1px solid #e5e9f2; padding-bottom: 6px; }
  p { margin: 0; }
  ul { margin: 0; padding-left: 20px; }
  li { margin-bottom: 6px; }
  @media print {
    body { margin: 0; }
    a { color: inherit; text-decoration: none; }
  }
</style>
</head>
<body>
  <h1>Rapport IA — ${esc(this.testCaseNom)}</h1>
  ${generatedAt ? `<div class="meta">Généré le ${esc(generatedAt)}</div>` : ''}
  <div class="severity-chip ${severityClass}">${esc(severity)}</div>

  <section>
    <h2>Résumé</h2>
    <p>${esc(report.summary ?? '')}</p>
  </section>

  ${listBlock('Points positifs', strengths)}
  ${listBlock('Risques identifiés', risks)}
  ${listBlock('Recommandations', recommendations)}
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-ia-${this.testCaseNom.trim().toLowerCase().replace(/\s+/g, '-')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private resetAiReport(): void {
    this.aiReport.set(null);
    this.aiReportVisible.set(false);
    this.aiReportLoading.set(false);
    this.aiReportError.set(null);
  }

  private loadLatest(): void {
    if (this.testCaseId == null) return;
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