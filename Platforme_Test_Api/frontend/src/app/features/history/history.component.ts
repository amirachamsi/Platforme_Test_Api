import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CampaignService } from '../../core/services/campaign.service';
import { ExecutionService } from '../../core/services/execution.service';
import { PingHistoryService } from '../../core/services/ping-history.service';
import { Campaign, CampaignLaunch, CampaignTestCaseRef, Execution, PingResult, TestCase } from '../../core/models/models';
import { ExecutionDetailsOverlayComponent } from '../../shared/execution-details-overlay/execution-details-overlay.component';

type HistoryTab = 'campagnes' | 'executions' | 'pings';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule, ExecutionDetailsOverlayComponent],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent implements OnInit {
  activeTab = signal<HistoryTab>('campagnes');
  searchQuery = signal('');
  sortAscending = signal(false);
  pageSize = signal(10);
  currentPage = signal(1);

  campaignLaunches = signal<CampaignLaunch[]>([]);
  executions = signal<Execution[]>([]);
  pings = signal<PingResult[]>([]);

  loadingCampaigns = signal(false);
  loadingExecutions = signal(false);
  loadingPings = signal(false);

  // Expanded launch shows the campaign's *current* test case list + results —
  // not a historical snapshot of what was included at that specific launch
  // (CampaignLaunch only stores a count, not the actual list at that time).
  // Fetched on demand rather than eagerly on every launch row.
  expandedLaunchId = signal<number | null>(null);
  expandedCampaign = signal<Campaign | null>(null);
  expandedLoading = signal(false);

  showOverlay = signal(false);
  overlayExecution = signal<Execution | null>(null);
  overlayScenario = signal<TestCase | null>(null);
  downloadingId = signal<number | null>(null);
  deletingId = signal<number | null>(null);
  deletingAll = signal(false);
  executionDeleteError = signal('');
  deletingPingId = signal<number | null>(null);
  deletingAllPings = signal(false);
  pingDeleteError = signal('');
  showDeleteConfirm = signal(false);
  deleteConfirmTitle = signal('');
  deleteConfirmMessage = signal('');
  deleteConfirmActionLabel = signal('Supprimer');
  private pendingDeleteAction: (() => void) | null = null;

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
    this.searchQuery.set('');
    this.currentPage.set(1);
  }

  toggleSortOrder(): void {
    this.sortAscending.set(!this.sortAscending());
    this.currentPage.set(1);
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.currentPage.set(1);
  }

  onPageSizeChange(value: string | number): void {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n <= 0) return;
    this.pageSize.set(n);
    this.currentPage.set(1);
  }

  // --- Pagination (client-side, over whichever tab's filtered+sorted list is active) ---

  get activeFilteredLength(): number {
    switch (this.activeTab()) {
      case 'campagnes': return this.filteredCampaignLaunches.length;
      case 'executions': return this.filteredExecutions.length;
      case 'pings': return this.filteredPings.length;
    }
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.activeFilteredLength / this.pageSize()));
  }

  /** Self-healing: if a deletion shrinks the list past the current page, this
   * clamps back to the last valid page automatically, no manual reset needed. */
  get clampedPage(): number {
    return Math.min(Math.max(1, this.currentPage()), this.totalPages);
  }

  get pagedCampaignLaunches(): CampaignLaunch[] {
    return this.paginate(this.filteredCampaignLaunches);
  }

  get pagedExecutions(): Execution[] {
    return this.paginate(this.filteredExecutions);
  }

  get pagedPings(): PingResult[] {
    return this.paginate(this.filteredPings);
  }

  goToPage(page: number): void {
    this.currentPage.set(Math.max(1, Math.min(page, this.totalPages)));
  }

  prevPage(): void {
    this.goToPage(this.clampedPage - 1);
  }

  nextPage(): void {
    this.goToPage(this.clampedPage + 1);
  }

  private paginate<T>(list: T[]): T[] {
    const start = (this.clampedPage - 1) * this.pageSize();
    return list.slice(start, start + this.pageSize());
  }

  get searchPlaceholder(): string {
    switch (this.activeTab()) {
      case 'campagnes': return 'Rechercher par nom de campagne…';
      case 'executions': return 'Rechercher par nom de scénario…';
      case 'pings': return 'Rechercher par nom d’endpoint…';
    }
  }

  get filteredCampaignLaunches(): CampaignLaunch[] {
    const query = this.searchQuery().trim().toLowerCase();
    const list = this.campaignLaunches().filter(
      (l) => !query || (l.campaign?.nom ?? '').toLowerCase().includes(query));
    return this.sortAscending() ? [...list].reverse() : list;
  }

  get filteredExecutions(): Execution[] {
    const query = this.searchQuery().trim().toLowerCase();
    const list = this.executions().filter(
      (e) => !query || (e.testcase?.nom ?? '').toLowerCase().includes(query));
    return this.sortAscending() ? [...list].reverse() : list;
  }

  get filteredPings(): PingResult[] {
    const query = this.searchQuery().trim().toLowerCase();
    const list = this.pings().filter(
      (p) => !query || (p.endpoint?.nom ?? '').toLowerCase().includes(query));
    return this.sortAscending() ? [...list].reverse() : list;
  }

  // --- Execution overlay (used by both the Executions tab and expanded launches) ---

  openExecutionOverlay(execution: Execution, scenario?: TestCase, event?: Event): void {
    event?.stopPropagation();
    this.overlayExecution.set(execution);
    this.overlayScenario.set(scenario ?? execution.testcase ?? null);
    this.showOverlay.set(true);
  }

  closeOverlay(): void {
    this.showOverlay.set(false);
    this.overlayExecution.set(null);
    this.overlayScenario.set(null);
  }

  downloadExecutionReport(execution: Execution, event?: Event): void {
    event?.stopPropagation();
    if (!execution.id || this.downloadingId() != null) return;

    this.downloadingId.set(execution.id);
    const safeName = (execution.testcase?.nom ?? 'execution')
      .replace(/[^\w\-]+/g, '_')
      .slice(0, 40);
    this.executionService
      .downloadReport(execution.id, `rapport-${safeName}-${execution.id}.html`, true)
      .subscribe({
        next: () => this.downloadingId.set(null),
        error: () => this.downloadingId.set(null),
      });
  }

  deleteExecution(execution: Execution, event?: Event): void {
    event?.stopPropagation();
    if (!execution.id || this.deletingId() !== null || this.deletingAll()) return;
    this.openDeleteConfirm(
      'Supprimer l\'execution',
      `Voulez-vous supprimer l'execution "${execution.testcase?.nom ?? 'inconnue'}" de l'historique ?`,
      () => this.performDeleteExecution(execution),
      'Supprimer l\'execution',
    );
  }

  private performDeleteExecution(execution: Execution): void {
    this.closeDeleteConfirm();
    const executionId = execution.id;
    if (executionId == null) return;

    this.executionDeleteError.set('');
    this.deletingId.set(executionId);
    this.executionService.delete(executionId).subscribe({
      next: () => {
        this.executions.update((executions) => executions.filter((item) => item.id !== executionId));
        if (this.overlayExecution()?.id === executionId) this.closeOverlay();
        this.deletingId.set(null);
      },
      error: () => {
        this.executionDeleteError.set('Impossible de supprimer cette exécution.');
        this.deletingId.set(null);
      },
    });
  }

  deleteAllExecutions(): void {
    if (this.deletingAll() || this.deletingId() !== null || this.executions().length === 0) return;
    this.openDeleteConfirm(
      'Supprimer tout l\'historique des executions',
      `Voulez-vous supprimer toutes les executions de l'historique (${this.executions().length} element(s)) ?`,
      () => this.performDeleteAllExecutions(),
      'Supprimer tout',
    );
  }

  private performDeleteAllExecutions(): void {
    this.closeDeleteConfirm();

    this.executionDeleteError.set('');
    this.deletingAll.set(true);
    this.executionService.deleteAll().subscribe({
      next: () => {
        this.executions.set([]);
        this.closeOverlay();
        this.deletingAll.set(false);
      },
      error: () => {
        this.executionDeleteError.set('Impossible de supprimer l’historique des exécutions.');
        this.deletingAll.set(false);
      },
    });
  }

  deletePing(ping: PingResult): void {
    if (!ping.id || this.deletingPingId() !== null || this.deletingAllPings()) return;
    this.openDeleteConfirm(
      'Supprimer le ping',
      `Voulez-vous supprimer le ping de l'endpoint "${ping.endpoint?.nom ?? 'inconnu'}" ?`,
      () => this.performDeletePing(ping),
      'Supprimer le ping',
    );
  }

  private performDeletePing(ping: PingResult): void {
    this.closeDeleteConfirm();
    const pingId = ping.id;
    if (pingId == null) return;

    this.pingDeleteError.set('');
    this.deletingPingId.set(pingId);
    this.pingHistoryService.delete(pingId).subscribe({
      next: () => {
        this.pings.update((pings) => pings.filter((item) => item.id !== pingId));
        this.deletingPingId.set(null);
      },
      error: () => {
        this.pingDeleteError.set('Impossible de supprimer ce ping.');
        this.deletingPingId.set(null);
      },
    });
  }

  deleteAllPings(): void {
    if (this.deletingAllPings() || this.deletingPingId() !== null || this.pings().length === 0) return;
    this.openDeleteConfirm(
      'Supprimer tout l\'historique des pings',
      `Voulez-vous supprimer tous les pings de l'historique (${this.pings().length} element(s)) ?`,
      () => this.performDeleteAllPings(),
      'Supprimer tout',
    );
  }

  private performDeleteAllPings(): void {
    this.closeDeleteConfirm();

    this.pingDeleteError.set('');
    this.deletingAllPings.set(true);
    this.pingHistoryService.deleteAll().subscribe({
      next: () => {
        this.pings.set([]);
        this.deletingAllPings.set(false);
      },
      error: () => {
        this.pingDeleteError.set('Impossible de supprimer l’historique des pings.');
        this.deletingAllPings.set(false);
      },
    });
  }

  // --- Expand a campaign launch: fetch the current campaign + its test cases,
  // then let the user click one to see its latest execution result. ---

  toggleExpandLaunch(launch: CampaignLaunch): void {
    if (this.expandedLaunchId() === launch.id) {
      this.expandedLaunchId.set(null);
      this.expandedCampaign.set(null);
      return;
    }
    if (!launch.campaign?.id) return;

    this.expandedLaunchId.set(launch.id!);
    this.expandedCampaign.set(null);
    this.expandedLoading.set(true);

    this.campaignService.getById(launch.campaign.id).subscribe({
      next: (campaign) => {
        this.expandedCampaign.set(campaign);
        this.expandedLoading.set(false);
      },
      error: () => {
        this.expandedLoading.set(false);
      },
    });
  }

  orderedRefs(campaign: Campaign): CampaignTestCaseRef[] {
    return [...(campaign.testCases ?? [])].sort((a, b) => a.ordre - b.ordre);
  }

  openScenarioLatest(testCase: TestCase, event?: Event): void {
    event?.stopPropagation();
    this.executionService.getLatest(testCase.id!).subscribe({
      next: (execution) => {
        this.overlayExecution.set(execution);
        this.overlayScenario.set(testCase);
        this.showOverlay.set(true);
      },
    });
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