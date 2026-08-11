import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TestcaseService } from '../../core/services/testcase.service';
import { ExecutionService } from '../../core/services/execution.service';
import { CampaignService } from '../../core/services/campaign.service';
import { Campaign, CampaignMode, CampaignRequest, CampaignTestCaseRef, TestCase } from '../../core/models/models';
import { ExecutionDetailsOverlayComponent } from '../../shared/execution-details-overlay/execution-details-overlay.component';

interface ProgressState {
  progress: number;
  label: string;
  indeterminate: boolean;
  isEstimate: boolean;
}

@Component({
  selector: 'app-campaign',
  standalone: true,
  imports: [CommonModule, FormsModule, ExecutionDetailsOverlayComponent],
  templateUrl: './campaigns.component.html',
  styleUrl: './campaigns.component.scss',
})
export class CampaignsComponent implements OnInit {
  campaigns = signal<Campaign[]>([]);
  allTestCases: TestCase[] = [];

  showForm = signal(false);
  editingId = signal<number | null>(null);
  saving = signal(false);
  error = signal<string | null>(null);

  searchQuery = signal('');

  // Per-campaign expand/collapse (shows its test cases + lets you click one to
  // open its execution results).
  expandedCampaignId = signal<number | null>(null);

  // Which campaign is currently launching — disables its own launch button
  // (campaigns don't run concurrently with each other, only their own test
  // cases might, in PARALLELE mode).
  launchingCampaignId = signal<number | null>(null);
  launchError = signal<string | null>(null);

  // Per-testcase progress, keyed by testcase id — several can be populated at
  // once in PARALLELE mode, only one at a time in SEQUENTIELLE mode.
  testProgress = signal<Map<number, ProgressState>>(new Map());
  private progressIntervals = new Map<number, number>();

  // Shared results overlay state.
  showOverlay = signal(false);
  overlayTestCase = signal<TestCase | null>(null);

  form = this.emptyForm();
  private draggedIndex: number | null = null;

  constructor(
    private testcaseService: TestcaseService,
    private executionService: ExecutionService,
    private campaignService: CampaignService,
  ) {}

  ngOnInit(): void {
    this.testcaseService.list().subscribe({
      next: (testCases) => this.allTestCases = testCases,
      error: () => this.allTestCases = [],
    });
    this.loadCampaigns();
  }

  // --- Form lifecycle ---

  toggleForm(): void {
    this.showForm.set(!this.showForm());
    if (!this.showForm()) this.resetForm();
  }

  editCampaign(campaign: Campaign, event?: Event): void {
    event?.stopPropagation();
    this.editingId.set(campaign.id!);
    const ordered = [...(campaign.testCases ?? [])].sort((a, b) => a.ordre - b.ordre);
    this.form = {
      nom: campaign.nom,
      description: campaign.description ?? '',
      mode: campaign.mode ?? 'PARALLELE',
      selectedTestCases: ordered.map((ref) => ref.testcase),
    };
    this.searchQuery.set('');
    this.showForm.set(true);
  }

  submit(): void {
    if (!this.form.nom.trim()) {
      this.error.set('Veuillez renseigner un nom pour la campagne.');
      return;
    }
    if (this.form.selectedTestCases.length === 0) {
      this.error.set('Veuillez sélectionner au moins un cas de test.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const payload: CampaignRequest = {
      nom: this.form.nom,
      description: this.form.description,
      mode: this.form.mode,
      testCaseIds: this.form.selectedTestCases.map((tc) => tc.id!),
    };

    const request$ = this.editingId() === null
      ? this.campaignService.create(payload)
      : this.campaignService.update(this.editingId()!, payload);

    request$.subscribe({
      next: () => {
        this.loadCampaigns();
        this.showForm.set(false);
        this.resetForm();
        this.saving.set(false);
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Impossible d’enregistrer la campagne. Vérifiez le backend puis réessayez.');
      },
    });
  }

  deleteCampaign(campaign: Campaign, event?: Event): void {
    event?.stopPropagation();
    this.campaignService.delete(campaign.id!).subscribe({
      next: () => this.campaigns.update((list) => list.filter((c) => c.id !== campaign.id)),
    });
  }

  // --- Test case search-to-add ---

  get searchResults(): TestCase[] {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) return [];
    const selectedIds = new Set(this.form.selectedTestCases.map((tc) => tc.id));
    return this.allTestCases
      .filter((tc) => tc.nom.toLowerCase().includes(query) && !selectedIds.has(tc.id))
      .slice(0, 8);
  }

  addTestCase(testCase: TestCase): void {
    this.form.selectedTestCases = [...this.form.selectedTestCases, testCase];
    this.searchQuery.set('');
  }

  removeTestCase(testCase: TestCase): void {
    this.form.selectedTestCases = this.form.selectedTestCases.filter((tc) => tc.id !== testCase.id);
  }

  // --- Drag-to-reorder (SEQUENTIELLE mode only) ---

  onDragStart(index: number): void {
    this.draggedIndex = index;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(index: number): void {
    if (this.draggedIndex === null || this.draggedIndex === index) return;
    const items = [...this.form.selectedTestCases];
    const [moved] = items.splice(this.draggedIndex, 1);
    items.splice(index, 0, moved);
    this.form.selectedTestCases = items;
    this.draggedIndex = null;
  }

  // --- Expand/collapse + results overlay ---

  toggleExpand(campaign: Campaign, event?: Event): void {
    event?.stopPropagation();
    this.expandedCampaignId.set(this.expandedCampaignId() === campaign.id ? null : campaign.id!);
  }

  orderedRefs(campaign: Campaign): CampaignTestCaseRef[] {
    return [...(campaign.testCases ?? [])].sort((a, b) => a.ordre - b.ordre);
  }

  openOverlay(testCase: TestCase, event?: Event): void {
    event?.stopPropagation();
    this.overlayTestCase.set(testCase);
    this.showOverlay.set(true);
  }

  closeOverlay(): void {
    this.showOverlay.set(false);
    this.overlayTestCase.set(null);
  }

  // --- Launch ---

  /**
   * Timestamps the launch server-side, then orchestrates execution from here:
   * PARALLELE fires every test case's execute() concurrently; SEQUENTIELLE
   * awaits each one in order before starting the next. Each test case gets
   * its own progress bar (see startTestProgress), same estimate/indeterminate
   * logic as the single-testcase page.
   */
  launchCampaign(campaign: Campaign, event?: Event): void {
    event?.stopPropagation();
    if (this.launchingCampaignId() !== null) return;

    this.launchingCampaignId.set(campaign.id!);
    this.launchError.set(null);

    this.campaignService.launch(campaign.id!).subscribe({
      next: (updated) => {
        this.campaigns.update((list) =>
          list.map((c) => (c.id === campaign.id ? { ...c, lastLaunchedAt: updated.lastLaunchedAt } : c)));
      },
    });

    const orderedTestCases = this.orderedRefs(campaign).map((ref) => ref.testcase);
    const finishAll = () => {
      this.launchingCampaignId.set(null);
      this.expandedCampaignId.set(campaign.id!);
    };

    if (campaign.mode === 'SEQUENTIELLE') {
      (async () => {
        for (const testCase of orderedTestCases) {
          await this.runOneTestCase(testCase);
        }
        finishAll();
      })();
    } else {
      Promise.all(orderedTestCases.map((testCase) => this.runOneTestCase(testCase))).then(finishAll);
    }
  }

  private runOneTestCase(testCase: TestCase): Promise<void> {
    return new Promise((resolve) => {
      const proceed = (durationSec: number | null, isEstimate: boolean) => {
        this.startTestProgress(testCase.id!, durationSec, isEstimate);
        this.executionService.execute(testCase.id!).subscribe({
          next: () => this.finishTestProgress(testCase.id!, resolve),
          error: () => this.finishTestProgress(testCase.id!, resolve),
        });
      };

      if (testCase.executionMode === 'REQUETES') {
        this.executionService.getLatest(testCase.id!).subscribe({
          next: (lastExecution) => {
            const target = testCase.nombreRequetes ?? 0;
            const previousRps = lastExecution?.rpsMoyen;
            const estimate = (target && previousRps && previousRps > 0) ? target / previousRps : null;
            proceed(estimate, true);
          },
          error: () => proceed(null, true),
        });
      } else {
        proceed(testCase.dureeSec ?? 10, false);
      }
    });
  }

  private startTestProgress(testCaseId: number, durationSec: number | null, isEstimate: boolean): void {
    this.clearTestProgressInterval(testCaseId);
    const startedAt = Date.now();

    if (durationSec === null) {
      this.setProgress(testCaseId, { progress: 0, label: 'En cours… (durée non estimable)', indeterminate: true, isEstimate });
      const interval = window.setInterval(() => {
        const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
        this.setProgress(testCaseId, {
          progress: 0,
          label: `En cours depuis ${elapsedSec}s… (durée non estimable)`,
          indeterminate: true,
          isEstimate,
        });
      }, 1000);
      this.progressIntervals.set(testCaseId, interval);
      return;
    }

    const totalMs = durationSec * 1000;
    const maxPct = 92;
    const suffix = isEstimate ? ' (estimation)' : '';
    this.setProgress(testCaseId, { progress: 0, label: 'Initialisation…', indeterminate: false, isEstimate });

    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const ratio = Math.min(elapsed / totalMs, 1);
      const pct = Math.round(ratio * maxPct);
      const label = elapsed < totalMs
        ? `En cours… ~${Math.max(0, Math.ceil((totalMs - elapsed) / 1000))}s restantes${suffix}`
        : `Finalisation…${suffix}`;
      this.setProgress(testCaseId, { progress: pct, label, indeterminate: false, isEstimate });
    }, 250);
    this.progressIntervals.set(testCaseId, interval);
  }

  private finishTestProgress(testCaseId: number, then: () => void): void {
    this.clearTestProgressInterval(testCaseId);
    this.setProgress(testCaseId, { progress: 100, label: 'Terminé', indeterminate: false, isEstimate: false });
    window.setTimeout(() => {
      this.removeProgress(testCaseId);
      then();
    }, 400);
  }

  private clearTestProgressInterval(testCaseId: number): void {
    const id = this.progressIntervals.get(testCaseId);
    if (id !== undefined) {
      window.clearInterval(id);
      this.progressIntervals.delete(testCaseId);
    }
  }

  private setProgress(testCaseId: number, state: ProgressState): void {
    const map = new Map(this.testProgress());
    map.set(testCaseId, state);
    this.testProgress.set(map);
  }

  private removeProgress(testCaseId: number): void {
    const map = new Map(this.testProgress());
    map.delete(testCaseId);
    this.testProgress.set(map);
  }

  private loadCampaigns(): void {
    this.campaignService.list().subscribe({
      next: (campaigns) => this.campaigns.set(campaigns),
      error: () => this.campaigns.set([]),
    });
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.searchQuery.set('');
    this.form = this.emptyForm();
  }

  private emptyForm() {
    return {
      nom: '',
      description: '',
      mode: 'PARALLELE' as CampaignMode,
      selectedTestCases: [] as TestCase[],
    };
  }
}