import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EndpointService } from '../../core/services/endpoint.service';
import { ApiEndpoint } from '../../core/models/models';

interface ScenarioItem {
  id: number;
  nom: string;
  typeTest: string;
  endpoint: string;
  codeAttendu: number;
  seuilMs: number;
  assertions: string;
}

interface CampaignItem {
  id: number;
  nom: string;
  endpoint: string;
  scenarios: ScenarioItem[];
  createdAt: string;
}

@Component({
  selector: 'app-campaigns',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './campaigns.component.html',
  styleUrl: './campaigns.component.scss',
})
export class CampaignsComponent implements OnInit {
  campaigns = signal<CampaignItem[]>([]);
  showForm = signal(false);
  endpoints: ApiEndpoint[] = [];
  availableScenarios: ScenarioItem[] = [];
  selectedScenarioIds = signal<number[]>([]);

  form = {
    nom: '',
    endpointId: '',
  };

  private readonly demoEndpoints: ApiEndpoint[] = [
    { id: 1, target: { id: 1 }, nom: 'Vérification solde', methode: 'GET', chemin: '/api/clients/solde' },
    { id: 2, target: { id: 1 }, nom: 'Création de virement', methode: 'POST', chemin: '/api/virements' },
    { id: 3, target: { id: 1 }, nom: 'Consultation historique', methode: 'GET', chemin: '/api/operations/historique' },
  ];

  private readonly demoScenarios: ScenarioItem[] = [
    {
      id: 1,
      nom: 'Scénario solde',
      typeTest: 'Fonctionnel',
      endpoint: 'GET /api/clients/solde',
      codeAttendu: 200,
      seuilMs: 800,
      assertions: 'Vérification du statut 200 et du contenu du payload.',
    },
    {
      id: 2,
      nom: 'Scénario virement',
      typeTest: 'Sécurité',
      endpoint: 'POST /api/virements',
      codeAttendu: 201,
      seuilMs: 1200,
      assertions: 'Validation des permissions et du format des données.',
    },
    {
      id: 3,
      nom: 'Scénario historique',
      typeTest: 'Performance',
      endpoint: 'GET /api/operations/historique',
      codeAttendu: 200,
      seuilMs: 1500,
      assertions: 'Vérification du temps de réponse et du contenu des entrées.',
    },
  ];

  constructor(private endpointService: EndpointService) {}

  ngOnInit(): void {
    this.availableScenarios = this.demoScenarios;
    this.endpointService.list().subscribe({
      next: (data) => {
        this.endpoints = data.length ? data : this.demoEndpoints;
      },
      error: () => {
        this.endpoints = this.demoEndpoints;
      },
    });
  }

  toggleForm(): void {
    this.showForm.set(!this.showForm());
    if (!this.showForm()) {
      this.resetForm();
    }
  }

  toggleScenario(id: number): void {
    const current = this.selectedScenarioIds();
    this.selectedScenarioIds.set(current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  isSelected(id: number): boolean {
    return this.selectedScenarioIds().includes(id);
  }

  submit(): void {
    const endpointId = Number(this.form.endpointId);
    if (!this.form.nom || !endpointId || this.selectedScenarioIds().length === 0) return;

    const endpoint = this.endpoints.find((item) => item.id === endpointId);
    const selectedScenarios = this.availableScenarios.filter((scenario) => this.selectedScenarioIds().includes(scenario.id));
    const nextCampaign: CampaignItem = {
      id: Date.now(),
      nom: this.form.nom,
      endpoint: endpoint ? `${endpoint.methode} ${endpoint.chemin}` : `Endpoint #${endpointId}`,
      scenarios: selectedScenarios,
      createdAt: new Date().toLocaleDateString('fr-FR'),
    };

    this.campaigns.set([nextCampaign, ...this.campaigns()]);
    this.showForm.set(false);
    this.resetForm();
  }

  deleteCampaign(campaign: CampaignItem): void {
    this.campaigns.set(this.campaigns().filter((item) => item.id !== campaign.id));
  }

  private resetForm(): void {
    this.form = { nom: '', endpointId: '' };
    this.selectedScenarioIds.set([]);
  }
}
