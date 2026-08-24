import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ApiTargetService } from '../../core/services/api-target.service';
import { EndpointService } from '../../core/services/endpoint.service';
import { ApiTarget, ApiEndpoint } from '../../core/models/models';

@Component({
  selector: 'app-targets',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './targets.component.html',
  styleUrl: './targets.component.scss',
})
export class TargetsComponent implements OnInit {
  private readonly targetService = inject(ApiTargetService);
  private readonly endpointService = inject(EndpointService);

  targets = signal<ApiTarget[]>([]);
  showForm = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  editingId = signal<number | null>(null);

  selectedTargetId = signal<number | null>(null);
  selectedTargetName = signal<string>('');
  endpoints = signal<ApiEndpoint[]>([]);
  showEndpointForm = signal(false);
  endpointSaving = signal(false);
  endpointError = signal<string | null>(null);
  endpointEditingId = signal<number | null>(null);
  pingingEndpointId = signal<number | null>(null);
  formStep = signal<1 | 2 | 3>(1);
  endpointTab = signal<'params' | 'headers' | 'body'>('params');
  bodyJsonError = signal<string | null>(null);
  showDeleteConfirm = signal(false);
  deleteConfirmTitle = signal('');
  deleteConfirmMessage = signal('');
  deleteConfirmActionLabel = signal('Supprimer');

  form: ApiTarget = this.createEmptyForm();
  endpointForm: ApiEndpoint = this.createEmptyEndpointForm();
  // Dynamic headers and params lists for the form (local-only)
  endpointHeaders: { key: string; value: string; enabled: boolean }[] = [];
  endpointParams: { key: string; value: string; enabled: boolean }[] = [];
  private pendingDeleteAction: (() => void) | null = null;

  selectedTargetAuthType = signal<'NONE' | 'BEARER' | 'API_KEY' | 'OAUTH2'>('NONE');
  selectedTargetSecretRef: string | undefined = undefined;
  selectedTargetKeyName: string | undefined = undefined;
  selectedTargetKeyIn: 'HEADER' | 'QUERY' | undefined = undefined;

  

  ngOnInit(): void {
    this.loadTargets();
  }

  private loadTargets(): void {
    this.targetService.list().subscribe({
      next: (data) => this.targets.set(data),
      error: () => this.targets.set([]),
    });
  }

  
  openTargetForm(): void {
    this.editingId.set(null);
    this.form = this.createEmptyForm();
    this.endpointForm = this.createEmptyEndpointForm();
    this.endpointHeaders = [];
    this.endpointParams = [];
    this.formStep.set(1);
    this.endpointTab.set('params');
    this.bodyJsonError.set(null);
    this.error.set(null);
    this.showForm.set(true);
  }

  closeTargetForm(): void {
    this.showForm.set(false);
    this.resetForm();
  }

  selectTarget(target: ApiTarget): void {
    this.selectedTargetId.set(target.id ?? null);
    this.selectedTargetName.set(target.nom);
    // Was `.set(true)` — selecting a target to view its endpoints shouldn't also
    // force the add-endpoint form open immediately.
    this.showEndpointForm.set(false);
    this.endpointEditingId.set(null);
    this.endpointForm = this.createEmptyEndpointForm();
    this.endpointHeaders = [];
    this.endpointParams = [];
    this.selectedTargetAuthType.set(target.authType ?? 'NONE');
    this.selectedTargetSecretRef = target.secretRef;
    this.selectedTargetKeyName = target.keyName;
    this.selectedTargetKeyIn = target.keyIn;
    this.loadEndpoints(target.id);
  }

  closeEndpointsOverlay(): void {
    this.selectedTargetId.set(null);
    this.selectedTargetName.set('');
    this.endpoints.set([]);
    this.showEndpointForm.set(false);
  }

  openEndpointForm(): void {
    this.endpointEditingId.set(null);
    this.endpointForm = this.createEmptyEndpointForm();
    this.endpointHeaders = [];
    this.endpointParams = [];
    this.bodyJsonError.set(null);
    this.endpointError.set(null);
    this.showEndpointForm.set(true);
  }

  closeEndpointForm(): void {
    this.showEndpointForm.set(false);
    this.endpointEditingId.set(null);
    this.endpointForm = this.createEmptyEndpointForm();
    this.endpointHeaders = [];
    this.endpointParams = [];
    this.bodyJsonError.set(null);
    this.endpointError.set(null);
  }

  private loadEndpoints(targetId?: number): void {
    if (!targetId) {
      this.endpoints.set([]);
      return;
    }

    this.endpointService.list(targetId).subscribe({
      next: (data) => this.endpoints.set(data),
      error: () => this.endpoints.set([]),
    });
  }

  editTarget(target: ApiTarget): void {
    this.editingId.set(target.id ?? null);
    this.form = { ...target }; // Copie de l'objet pour éviter la mutation directe
    this.endpointForm = this.createEmptyEndpointForm();
    this.endpointHeaders = [];
    this.endpointParams = [];
    this.formStep.set(1);
    this.endpointTab.set('params');
    this.bodyJsonError.set(null);
    this.showForm.set(true);
    this.error.set(null);
  }

  // SUPPRESSION D'UNE CIBLE
  deleteTarget(target: ApiTarget): void {
    this.openDeleteConfirm(
      'Supprimer la cible',
      `Voulez-vous vraiment supprimer la cible "${target.nom}" ?`,
      () => this.performDeleteTarget(target),
      'Supprimer la cible',
    );
  }

  private performDeleteTarget(target: ApiTarget): void {
    this.closeDeleteConfirm();

    if (target.id) {
      this.targetService.delete(target.id).subscribe({
        next: () => {
          this.loadTargets();
          if (this.selectedTargetId() === target.id) {
            this.selectedTargetId.set(null);
            this.endpoints.set([]);
          }
        },
        error: () => {
          // Fallback UI si backend déconnecté
          this.targets.update((list) => list.filter((t) => t.id !== target.id));
          if (this.selectedTargetId() === target.id) {
            this.selectedTargetId.set(null);
            this.endpoints.set([]);
          }
        }
      });
    }
  }

  // SOUMISSION (CRÉATION OU MODIFICATION)
  submit(): void {
    if (!this.form.nom || !this.form.urlBase) {
      this.error.set('Veuillez remplir les champs obligatoires (Nom et URL).');
      return;
    }

    const isEdit = this.editingId() !== null;
    const endpointStarted = !!(this.endpointForm.nom || this.endpointForm.chemin);
    if (!isEdit && endpointStarted && (!this.endpointForm.nom || !this.endpointForm.chemin)) {
      this.error.set('Veuillez renseigner le nom et le chemin du premier endpoint.');
      return;
    }
    if (!isEdit && endpointStarted && !this.validateEndpointBodyJson('form')) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const request$ = isEdit 
      ? this.targetService.update(this.editingId()!, this.form) 
      : this.targetService.create(this.form);

    request$.subscribe({
      next: (savedTarget) => {
        if (!isEdit && endpointStarted && savedTarget.id) {
          this.createInitialEndpoint(savedTarget.id);
          return;
        }
        this.loadTargets();
        this.finishSubmit();
      },
      error: () => {
        if (isEdit) {
          this.targets.update((list) =>
            list.map((t) => (t.id === this.editingId() ? { ...this.form } : t))
          );
        } else {
          const newMockTarget: ApiTarget = { ...this.form, id: Date.now() };
          this.targets.set([newMockTarget, ...this.targets()]);
          if (endpointStarted) {
            this.createInitialEndpoint(newMockTarget.id!, false);
            return;
          }
        }
        this.finishSubmit();
      },
    });
  }

  goToStep(step: 1 | 2 | 3): void {
    if (step > 1 && (!this.form.nom || !this.form.urlBase)) {
      this.error.set('Renseignez le nom et l’URL de base avant de poursuivre.');
      return;
    }
    this.error.set(null);
    this.formStep.set(step);
  }

  isBodySupported(): boolean {
    return !['GET', 'DELETE'].includes(this.endpointForm.methode);
  }

  previewUrl(): string {
    const base = (this.form.urlBase || '').replace(/\/$/, '');
    const path = (this.endpointForm.chemin || '').replace(/^\/?/, '/');
    const params = this.endpointParams
      .filter((param) => param.enabled && param.key)
      .map((param) => `${encodeURIComponent(param.key)}=${encodeURIComponent(param.value)}`)
      .join('&');
    return `${base}${path}${params ? `?${params}` : ''}`;
  }

  onBodyChange(): void {
    const body = (this.endpointForm.body || '').trim();
    if (this.endpointForm.methode === 'POST' && !body) {
      this.bodyJsonError.set('Le body est obligatoire pour une requete POST.');
      return;
    }
    if (!body || this.endpointForm.contentType !== 'application/json') {
      this.bodyJsonError.set(null);
      return;
    }
    try {
      JSON.parse(body);
      this.bodyJsonError.set(null);
    } catch (error: any) {
      this.bodyJsonError.set(error?.message || 'JSON invalide.');
    }
  }

  prettifyBody(): void {
    this.onBodyChange();
    if (this.bodyJsonError()) return;
    const body = (this.endpointForm.body || '').trim();
    if (body) this.endpointForm.body = JSON.stringify(JSON.parse(body), null, 2);
  }

  private createInitialEndpoint(targetId: number, reloadTargets = true): void {
    const headers = this.endpointHeaders
      .filter((header) => header.enabled && header.key)
      .map((header) => `${header.key}: ${header.value}`)
      .join('\n') || this.endpointForm.headers;
    const params = this.endpointParams
      .filter((param) => param.enabled && param.key)
      .map((param) => `${encodeURIComponent(param.key)}=${encodeURIComponent(param.value)}`)
      .join('&') || this.endpointForm.params;
    const cheminBase = this.endpointForm.chemin.split('?')[0];
    const payload: ApiEndpoint = {
      ...this.endpointForm,
      target: { id: targetId },
      headers: headers || undefined,
      params: params || undefined,
      chemin: params ? `${cheminBase}?${params}` : cheminBase,
    };

    this.endpointService.create(payload).subscribe({
      next: () => {
        if (reloadTargets) this.loadTargets();
        this.finishSubmit();
      },
      error: () => {
        this.endpoints.set([{ ...payload, id: Date.now() }, ...this.endpoints()]);
        if (reloadTargets) this.loadTargets();
        this.finishSubmit();
      },
    });
  }

  submitEndpoint(): void {
    if (!this.selectedTargetId() || !this.endpointForm.nom || !this.endpointForm.chemin) {
      this.endpointError.set('Veuillez renseigner le nom, la méthode HTTP et le chemin.');
      return;
    }

    this.endpointSaving.set(true);
    this.endpointError.set(null);

    if (!this.validateEndpointBodyJson('endpoint')) {
      this.endpointSaving.set(false);
      return;
    }

    // Serialize headers and params from local lists into the payload
    const headersStringFromList = this.endpointHeaders
      .filter((h) => h.enabled && h.key)
      .map((h) => `${h.key}: ${h.value}`)
      .join('\n');

    const queryStringFromList = this.endpointParams
      .filter((p) => p.enabled && p.key)
      .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join('&');

    // Fallback to free-text fields if dynamic lists are empty
    const headersString = headersStringFromList || (this.endpointForm.headers || '');
    const queryString = queryStringFromList || (this.endpointForm.params || '');

    const cheminBase = (this.endpointForm.chemin || '').split('?')[0];
    const finalChemin = queryString ? `${cheminBase}?${queryString}` : cheminBase;

    // Ensure auth headers or params are included if configured on the target
    let finalHeaders = headersString;
    let finalQuery = queryString;

    const authType = this.selectedTargetAuthType();
    if (authType === 'BEARER' && this.selectedTargetSecretRef) {
      if (!/authorization:/i.test(finalHeaders)) {
        finalHeaders = `Authorization: Bearer ${this.selectedTargetSecretRef}` + (finalHeaders ? `\n${finalHeaders}` : '');
      }
    }

    if (authType === 'API_KEY' && this.selectedTargetKeyName && this.selectedTargetSecretRef) {
      if (this.selectedTargetKeyIn === 'HEADER') {
        if (!new RegExp(`^${this.selectedTargetKeyName}:`, 'im').test(finalHeaders)) {
          finalHeaders = `${this.selectedTargetKeyName}: ${this.selectedTargetSecretRef}` + (finalHeaders ? `\n${finalHeaders}` : '');
        }
      } else {
        // Query param
        const pair = `${encodeURIComponent(this.selectedTargetKeyName)}=${encodeURIComponent(this.selectedTargetSecretRef)}`;
        finalQuery = finalQuery ? `${finalQuery}&${pair}` : pair;
      }
    }

    const payload: ApiEndpoint = {
      ...this.endpointForm,
      target: { id: this.selectedTargetId()! },
      headers: finalHeaders || undefined,
      params: finalQuery || undefined,
      chemin: finalChemin,
    };

    const isEdit = this.endpointEditingId() !== null;
    const request$ = isEdit
      ? this.endpointService.update(this.endpointEditingId()!, payload)
      : this.endpointService.create(payload);

    request$.subscribe({
      next: () => {
        this.loadEndpoints(this.selectedTargetId()!);
        this.finishEndpointSubmit();
      },
      error: () => {
        const nextList = this.endpoints().slice();
        if (isEdit) {
          this.endpoints.set(nextList.map((item) =>
            item.id === this.endpointEditingId() ? { ...payload, id: this.endpointEditingId()! } : item
          ));
        } else {
          const newMockEndpoint: ApiEndpoint = { ...payload, id: Date.now() };
          this.endpoints.set([newMockEndpoint, ...nextList]);
        }
        this.finishEndpointSubmit();
      },
    });
  }

  editEndpoint(endpoint: ApiEndpoint): void {
    this.endpointEditingId.set(endpoint.id ?? null);
    this.endpointForm = { ...endpoint };
    this.bodyJsonError.set(null);
    // Populate local headers/params lists from existing endpoint values
    this.endpointHeaders = [];
    if (endpoint.headers) {
      endpoint.headers.split(/\r?\n/).forEach((line) => {
        const idx = line.indexOf(':');
        if (idx !== -1) {
          const key = line.slice(0, idx).trim();
          const value = line.slice(idx + 1).trim();
          this.endpointHeaders.push({ key, value, enabled: true });
        }
      });
    }

    // Ensure the fallback textarea shows the same value
    this.endpointForm.headers = endpoint.headers || '';
    this.syncHeadersFromTextarea(this.endpointForm.headers);

    this.endpointParams = [];
    try {
      const q = (endpoint.chemin || '').split('?')[1] || '';
      if (q) {
        q.split('&').forEach((pair) => {
          const [k, v] = pair.split('=');
          if (k) this.endpointParams.push({ key: decodeURIComponent(k), value: decodeURIComponent(v || ''), enabled: true });
        });
      }
    } catch (e) {
      this.endpointParams = [];
    }

    // Ensure the fallback params input shows the same value
    const qString = (endpoint.chemin || '').split('?')[1] || '';
    this.endpointForm.params = qString;
    this.syncParamsFromInput(this.endpointForm.params || '');

    this.showEndpointForm.set(true);
    this.endpointError.set(null);
  }

  deleteEndpoint(endpoint: ApiEndpoint): void {
    this.openDeleteConfirm(
      'Supprimer l\'endpoint',
      `Voulez-vous vraiment supprimer l'endpoint "${endpoint.nom}" ?`,
      () => this.performDeleteEndpoint(endpoint),
      'Supprimer l\'endpoint',
    );
  }

  private performDeleteEndpoint(endpoint: ApiEndpoint): void {
    this.closeDeleteConfirm();

    if (!endpoint.id) {
      this.endpoints.update((list) => list.filter((item) => item !== endpoint));
      return;
    }

    this.endpointService.delete(endpoint.id).subscribe({
      next: () => {
        this.loadEndpoints(this.selectedTargetId()!);
      },
      error: () => {
        this.endpoints.update((list) => list.filter((item) => item.id !== endpoint.id));
      },
    });
  }

  pingEndpoint(endpoint: ApiEndpoint): void {
    if (!endpoint.id || this.pingingEndpointId() !== null) {
      return;
    }

    this.pingingEndpointId.set(endpoint.id);
    this.endpointService
      .ping(endpoint.id)
      .pipe(finalize(() => this.pingingEndpointId.set(null)))
      .subscribe({
        next: () => this.loadEndpoints(this.selectedTargetId()!),
        error: () => this.loadEndpoints(this.selectedTargetId()!),
      });
  }

  isEndpointPinging(endpoint: ApiEndpoint): boolean {
    return this.pingingEndpointId() === endpoint.id;
  }

  private finishSubmit(): void {
    this.saving.set(false);
    this.showForm.set(false);
    this.resetForm();
  }

  private finishEndpointSubmit(): void {
    this.endpointSaving.set(false);
    this.showEndpointForm.set(false);
    this.endpointEditingId.set(null);
    this.endpointForm = this.createEmptyEndpointForm();
    this.endpointHeaders = [];
    this.endpointParams = [];
    this.bodyJsonError.set(null);
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.form = this.createEmptyForm();
  }

  private createEmptyForm(): ApiTarget {
    return {
      nom: '',
      urlBase: '',
      authType: 'NONE',
      secretRef: '',
      keyName: '',
      keyIn: 'HEADER',
      tokenUrl: '',
      clientId: '',
      actif: true
    };
  }

  private createEmptyEndpointForm(): ApiEndpoint {
    return {
      target: { id: 0 },
      nom: '',
      methode: 'GET',
      chemin: '',
      headers: '',
      params: '',
      contentType: 'application/json',
      body: '',
      codeAttendu: 200,
      tempsMaxMs: 1000,
    };
  }

  // Helpers used from the template
  addHeader(): void {
    this.endpointHeaders.push({ key: '', value: '', enabled: true });
    this.syncTextareaFromHeaders();
  }

  removeHeader(index: number): void {
    this.endpointHeaders.splice(index, 1);
    this.syncTextareaFromHeaders();
  }

  addParam(): void {
    this.endpointParams.push({ key: '', value: '', enabled: true });
    this.syncInputFromParams();
  }

  removeParam(index: number): void {
    this.endpointParams.splice(index, 1);
    this.syncInputFromParams();
  }

  requestRemoveHeader(index: number): void {
    this.openDeleteConfirm(
      'Supprimer le header',
      `Voulez-vous supprimer le header #${index + 1} ?`,
      () => {
        this.removeHeader(index);
        this.closeDeleteConfirm();
      },
      'Supprimer le header',
    );
  }

  requestRemoveParam(index: number): void {
    this.openDeleteConfirm(
      'Supprimer le parametre',
      `Voulez-vous supprimer le parametre d'URL #${index + 1} ?`,
      () => {
        this.removeParam(index);
        this.closeDeleteConfirm();
      },
      'Supprimer le parametre',
    );
  }

  onHeaderChange(): void {
    this.syncTextareaFromHeaders();
  }

  onParamChange(): void {
    this.syncInputFromParams();
  }

  // Sync helpers for bi-directional conversion between textareas/inputs and kv lists
  syncHeadersFromTextarea(val: string): void {
    this.endpointHeaders = [];
    if (!val) {
      return;
    }
    val.split(/\r?\n/).forEach((line) => {
      const idx = line.indexOf(':');
      if (idx !== -1) {
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        if (key) this.endpointHeaders.push({ key, value, enabled: true });
      }
    });
  }

  syncTextareaFromHeaders(): void {
    this.endpointForm.headers = this.endpointHeaders
      .filter((h) => h.enabled && h.key)
      .map((h) => `${h.key}: ${h.value}`)
      .join('\n');
  }

  syncParamsFromInput(val: string): void {
    this.endpointParams = [];
    if (!val) return;
    val.split('&').forEach((pair) => {
      if (!pair) return;
      const [k, v] = pair.split('=');
      if (k) this.endpointParams.push({ key: decodeURIComponent(k), value: decodeURIComponent(v || ''), enabled: true });
    });
  }

  syncInputFromParams(): void {
    this.endpointForm.params = this.endpointParams
      .filter((p) => p.enabled && p.key)
      .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join('&');
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

  private validateEndpointBodyJson(scope: 'form' | 'endpoint'): boolean {
    const body = (this.endpointForm.body || '').trim();
    if (this.endpointForm.methode === 'POST' && !body) {
      const requiredMessage = 'Le body est obligatoire pour une requete POST.';
      this.bodyJsonError.set(requiredMessage);
      if (scope === 'form') {
        this.error.set(requiredMessage);
      } else {
        this.endpointError.set(requiredMessage);
      }
      return false;
    }
    if (!body || this.endpointForm.contentType !== 'application/json') {
      this.bodyJsonError.set(null);
      return true;
    }

    try {
      JSON.parse(body);
      this.bodyJsonError.set(null);
      return true;
    } catch (error: any) {
      const message = error?.message || 'JSON invalide.';
      this.bodyJsonError.set(message);
      if (scope === 'form') {
        this.error.set('Le body JSON du premier endpoint est invalide: ' + message);
      } else {
        this.endpointError.set('Corps JSON invalide: ' + message);
      }
      return false;
    }
  }
}