import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ExecutionService } from '../../core/services/execution.service';
import { CampaignService } from '../../core/services/campaign.service';
import { PingHistoryService } from '../../core/services/ping-history.service';
import { TestcaseService } from '../../core/services/testcase.service';
import { ApiTargetService } from '../../core/services/api-target.service';
import { Execution, CampaignLaunch, PingResult } from '../../core/models/models';
import { ExecutionDetailsOverlayComponent } from '../../shared/execution-details-overlay/execution-details-overlay.component';

interface Kpi { label: string; value: string; trend?: string; tone: 'good' | 'warn' | 'bad' | 'neutral'; }
interface SlowScenario { nom: string; p95: number; erreurs: number; runs: number; }

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, ExecutionDetailsOverlayComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private executionService = inject(ExecutionService);
  private campaignService = inject(CampaignService);
  private pingHistoryService = inject(PingHistoryService);
  private testcaseService = inject(TestcaseService);
  private targetService = inject(ApiTargetService);

  loadingExecutions = signal(true);
  loadingLaunches = signal(true);
  loadingPings = signal(true);

  kpis = signal<Kpi[]>([]);
  recentExecutions = signal<Execution[]>([]);
  slowScenarios = signal<SlowScenario[]>([]);
  recentLaunches = signal<CampaignLaunch[]>([]);
  failedPings = signal<PingResult[]>([]);

  scenarioCount = signal<number | null>(null);
  campaignCount = signal<number | null>(null);
  targetCount = signal<number | null>(null);

  showOverlay = signal(false);
  overlayExecution = signal<Execution | null>(null);

  ngOnInit(): void {
    this.load();
  }

  openExecutionOverlay(execution: Execution): void {
    this.overlayExecution.set(execution);
    this.showOverlay.set(true);
  }

  closeOverlay(): void {
    this.showOverlay.set(false);
    this.overlayExecution.set(null);
  }

  executionDuration(execution: Execution): string {
    if (!execution.dateDebut || !execution.dateFin) return '—';
    const ms = new Date(execution.dateFin).getTime() - new Date(execution.dateDebut).getTime();
    if (!(ms >= 0)) return '—';
    const totalSec = Math.round(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
  }

  executionMode(execution: Execution): string {
    return execution.executionMode === 'REQUETES'
      ? `${execution.nombreRequetes ?? '—'} req.`
      : `${execution.dureeSec ?? '—'}s`;
  }

  statutClass(statut?: string): string {
    switch (statut) {
      case 'REUSSIE': return 's2xx';
      case 'PARTIELLE': return 's4xx';
      case 'ECHOUEE': return 's5xx';
      default: return 's3xx';
    }
  }

  private load(): void {
    // Each section loads independently — one failing call shouldn't blank the whole page.
    this.executionService.getAll().subscribe({
      next: (executions) => {
        this.processExecutions(executions);
        this.loadingExecutions.set(false);
      },
      error: () => {
        this.processExecutions([]);
        this.loadingExecutions.set(false);
      },
    });

    this.campaignService.getLaunchHistory().subscribe({
      next: (launches) => {
        this.recentLaunches.set(launches.slice(0, 5));
        this.loadingLaunches.set(false);
      },
      error: () => {
        this.recentLaunches.set([]);
        this.loadingLaunches.set(false);
      },
    });

    this.pingHistoryService.getAll().subscribe({
      next: (pings) => {
        this.failedPings.set(pings.filter((p) => !p.success).slice(0, 5));
        this.loadingPings.set(false);
      },
      error: () => {
        this.failedPings.set([]);
        this.loadingPings.set(false);
      },
    });

    this.testcaseService.list().subscribe({
      next: (list) => this.scenarioCount.set(list.length),
      error: () => this.scenarioCount.set(null),
    });
    this.campaignService.list().subscribe({
      next: (list) => this.campaignCount.set(list.length),
      error: () => this.campaignCount.set(null),
    });
    this.targetService.list().subscribe({
      next: (list) => this.targetCount.set(list.length),
      error: () => this.targetCount.set(null),
    });
  }

  private processExecutions(executions: Execution[]): void {
    this.recentExecutions.set(executions.slice(0, 6));
    this.slowScenarios.set(this.computeSlowScenarios(executions));

    const now = Date.now();
    const THIRTY_D = 30 * 24 * 60 * 60 * 1000;
    const inWindow = (e: Execution, from: number, to: number): boolean => {
      const t = e.dateDebut ? new Date(e.dateDebut).getTime() : 0;
      return t >= from && t < to;
    };
    const current = executions.filter((e) => inWindow(e, now - THIRTY_D, now));
    const previous = executions.filter((e) => inWindow(e, now - 2 * THIRTY_D, now - THIRTY_D));

    this.kpis.set([
      this.buildCountKpi('Exécutions (30 j)', current.length, previous.length),
      this.buildRateKpi('Taux de réussite', current, previous),
      this.buildAvgKpi('p95 moyen (30 j)', current, previous, (e) => e.p95MesureMs, 'ms'),
      this.buildAvgKpi("Taux d'erreur moyen", current, previous, (e) => e.tauxErreurMesure, '%'),
    ]);
  }

  private buildCountKpi(label: string, current: number, previous: number): Kpi {
    if (previous === 0) {
      return { label, value: String(current), tone: 'neutral' };
    }
    const diff = current - previous;
    return {
      label,
      value: String(current),
      trend: `${diff >= 0 ? '+' : ''}${diff}`,
      tone: diff > 0 ? 'good' : diff < 0 ? 'warn' : 'neutral',
    };
  }

  private buildRateKpi(label: string, current: Execution[], previous: Execution[]): Kpi {
    const rate = (list: Execution[]): number | null =>
      list.length ? Math.round((list.filter((e) => e.statut === 'REUSSIE').length / list.length) * 1000) / 10 : null;

    const curRate = rate(current);
    const prevRate = rate(previous);
    const value = curRate !== null ? `${curRate.toFixed(1)} %` : '—';

    if (curRate === null || prevRate === null) {
      return { label, value, tone: 'neutral' };
    }
    const diff = Math.round((curRate - prevRate) * 10) / 10;
    return {
      label,
      value,
      trend: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)} pt`,
      tone: diff > 0 ? 'good' : diff < 0 ? 'bad' : 'neutral',
    };
  }

  /** Both p95 and error rate are "lower is better" metrics, hence the fixed tone direction. */
  private buildAvgKpi(
    label: string,
    current: Execution[],
    previous: Execution[],
    pick: (e: Execution) => number | undefined,
    unit: string,
  ): Kpi {
    const avg = (list: Execution[]): number | null => {
      const values = list.map(pick).filter((v): v is number => v != null);
      return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    };

    const curAvg = avg(current);
    const prevAvg = avg(previous);
    const value = curAvg !== null ? `${Math.round(curAvg * 10) / 10} ${unit}` : '—';

    if (curAvg === null || prevAvg === null) {
      return { label, value, tone: 'neutral' };
    }
    const diff = Math.round((curAvg - prevAvg) * 10) / 10;
    return {
      label,
      value,
      trend: `${diff >= 0 ? '+' : ''}${diff} ${unit}`,
      tone: diff === 0 ? 'neutral' : diff < 0 ? 'good' : 'bad',
    };
  }

  private computeSlowScenarios(executions: Execution[]): SlowScenario[] {
    const byName = new Map<string, { p95Sum: number; errSum: number; count: number }>();
    for (const e of executions) {
      const nom = e.testcase?.nom;
      if (!nom || e.p95MesureMs == null) continue;
      const entry = byName.get(nom) ?? { p95Sum: 0, errSum: 0, count: 0 };
      entry.p95Sum += e.p95MesureMs;
      entry.errSum += e.tauxErreurMesure ?? 0;
      entry.count += 1;
      byName.set(nom, entry);
    }
    return Array.from(byName.entries())
      .map(([nom, v]) => ({
        nom,
        p95: Math.round(v.p95Sum / v.count),
        erreurs: Math.round((v.errSum / v.count) * 10) / 10,
        runs: v.count,
      }))
      .sort((a, b) => b.p95 - a.p95)
      .slice(0, 5);
  }
}