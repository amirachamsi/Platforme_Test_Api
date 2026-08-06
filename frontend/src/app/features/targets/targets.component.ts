import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ApiTarget } from '../../core/models/models';

@Component({
  selector: 'app-targets',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './targets.component.html',
  styleUrl: './targets.component.scss',
})
export class TargetsComponent implements OnInit {
  private api = inject(ApiService);

  targets = signal<ApiTarget[]>([]);
  showForm = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  editingId = signal<number | null>(null);

  form: ApiTarget = this.createEmptyForm();

  private demo: ApiTarget[] = [
    { 
      id: 1, 
      nom: 'API bancaire simulée académique', 
      urlBase: 'https://mock-bank.example.com', 
      authType: 'BEARER', 
      actif: true 
    },
    { 
      id: 2, 
      nom: 'Référentiel clients (sandbox)', 
      urlBase: 'https://sandbox-crm.example.com', 
      authType: 'API_KEY', 
      keyName: 'X-API-Key', 
      keyIn: 'HEADER', 
      actif: true 
    },
  ];
  

  ngOnInit(): void {
    this.loadTargets();
  }

  private loadTargets(): void {
    this.api.listTargets().subscribe({
      next: (data) => this.targets.set(data),
      error: () => this.targets.set(this.demo),
    });
  }

  toggleForm(): void {
    this.showForm.update((v) => !v);
    this.error.set(null);
    if (!this.showForm()) {
      this.form = this.createEmptyForm();
    }
  }


  editTarget(target: ApiTarget): void {
    this.editingId.set(target.id ?? null);
    this.form = { ...target }; // Copie de l'objet pour éviter la mutation directe
    this.showForm.set(true);
    this.error.set(null);
  }

  // SUPPRESSION D'UNE CIBLE
  deleteTarget(target: ApiTarget): void {
    if (!confirm(`Voulez-vous vraiment supprimer la cible "${target.nom}" ?`)) {
      return;
    }

    if (target.id) {
      this.api.deleteTarget(target.id).subscribe({
        next: () => {
          this.loadTargets();
        },
        error: () => {
          // Fallback UI si backend déconnecté
          this.targets.update((list) => list.filter((t) => t.id !== target.id));
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

    this.saving.set(true);
    this.error.set(null);

    const isEdit = this.editingId() !== null;

    // Choix de la méthode API (Update ou Create)
    const request$ = isEdit 
      ? this.api.updateTarget(this.editingId()!, this.form) 
      : this.api.createTarget(this.form);

    request$.subscribe({
      next: () => {
        this.loadTargets();
        this.finishSubmit();
      },
      error: () => {
        // Fallback UI pour mode démo/hors-ligne
        if (isEdit) {
          this.targets.update((list) =>
            list.map((t) => (t.id === this.editingId() ? { ...this.form } : t))
          );
        } else {
          const newMockTarget: ApiTarget = { ...this.form, id: Date.now() };
          this.targets.set([newMockTarget, ...this.targets()]);
        }
        this.finishSubmit();
      },
    });
  }

  private finishSubmit(): void {
    this.saving.set(false);
    this.showForm.set(false);
    this.resetForm();
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.form = this.createEmptyForm();
  }

  private createEmptyForm(): ApiTarget {
    return {
      nom: '',
      urlBase: '',
      endpoint: '',
      httpMethod: 'GET',
      authType: 'NONE',
      secretRef: '',
      keyName: '',
      keyIn: 'HEADER',
      tokenUrl: '',
      clientId: '',
      actif: true
    };
  }
}