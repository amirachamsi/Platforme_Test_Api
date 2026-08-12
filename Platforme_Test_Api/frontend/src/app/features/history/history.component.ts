import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CampaignService } from '../../core/services/campaign.service';
import { ExecutionService } from '../../core/services/execution.service';
import { PingHistoryService } from '../../core/services/ping-history.service';
import { CampaignLaunch, Execution, PingResult } from '../../core/models/models';
import { ExecutionDetailsOverlayComponent } from '../../shared/execution-details-overlay/execution-details-overlay.component';

type HistoryTab = 'campagnes' | 'executions' | 'pings';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, ExecutionDetailsOverlayComponent],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent implements OnInit {
  activeTab = signal<HistoryTab>('campagnes');

  campaignLaunches = signal<CampaignLaunch[]>([]);
  executions = signal<Execution[]>([]);
  pings = signal<PingResult[]>([]);

  loadingCampaigns = signal(false);
  loadingExecutions = signal(false);
  loadingPings = signal(false);
  error = signal<string | null>(null);

  showOverlay = signal(false);
  overlayExecution = signal<Execution | null>(null);

  constructor(
    private campaignService: CampaignService,
    private executionService: ExecutionService,
    private pingHistoryService: PingHistoryService,
  ) {}

  ngOnInit(): void {
    this.loadCampaignLaunches();
    this.loadExecutions();
    this.loadPings();
  }

  setTab(tab: HistoryTab): void {
    this.activeTab.set(tab);
  }

  openExecutionOverlay(execution: Execution): void {
    this.overlayExecution.set(execution);
    this.showOverlay.set(true);
  }

  closeOverlay(): void {
    this.showOverlay.set(false);
    this.overlayExecution.set(null);
  }

  private loadCampaignLaunches(): void {
    this.loadingCampaigns.set(true);
    this.campaignService.getLaunchHistory().subscribe({
      next: (launches) => {
        this.campaignLaunches.set(launches);
        this.loadingCampaigns.set(false);
      },
      error: () => {
        this.campaignLaunches.set([]);
        this.loadingCampaigns.set(false);
      },
    });
  }

  private loadExecutions(): void {
    this.loadingExecutions.set(true);
    this.executionService.getAll().subscribe({
      next: (executions) => {
        this.executions.set(executions);
        this.loadingExecutions.set(false);
      },
      error: () => {
        this.executions.set([]);
        this.loadingExecutions.set(false);
      },
    });
  }

  private loadPings(): void {
    this.loadingPings.set(true);
    this.pingHistoryService.getAll().subscribe({
      next: (pings) => {
        this.pings.set(pings);
        this.loadingPings.set(false);
      },
      error: () => {
        this.pings.set([]);
        this.loadingPings.set(false);
      },
    });
  }
}