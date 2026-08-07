export type HttpMethodType = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type TestStatus =  'EN_ATTENTE' | 'EN_COURS' | 'REUSSIE' | 'ECHOUEE' | 'INTERROMPUE';
export type typeStatus = 'FONCTIONNEL' | 'PERFORMANCE' | 'SECURITE' | 'CHARGE';
export type authType = 'NONE' | 'BEARER' | 'OAUTH2' | 'API_KEY';

export interface ApiTarget {
  id?: number;
  nom: string;
  urlBase: string;
  authType: 'NONE' | 'BEARER' | 'API_KEY' | 'OAUTH2';
  secretRef?: string;
  keyName?: string;
  keyIn?: 'HEADER' | 'QUERY';
  tokenUrl?: string;
  clientId?: string;
  actif?: boolean;
}
export interface ApiEndpoint {
  id?: number;
  target: { id: number } | ApiTarget;
  nom: string;
  methode: HttpMethodType;
  chemin: string;
  headers?: string;
  params?: string;
  contentType?: string;
  body?: string;
  codeAttendu?: number;
  tempsMaxMs?: number;
  status?: boolean | null;
}

export interface TestCase {
  id?: number;
  endpoint: { id: number } | ApiEndpoint;
  nom: string;
  typeStatus?: typeStatus;  // Fonctionnel, Performance, Sécurité, Résilience
  teststatus?: TestStatus;      // EN_ATTENTE, EN_COURS, REUSSIE, ECHOUEE, INTERROMPUE
  seuilMs?: number;         // Objectif P95 cible (ex: < 1000 ms)
  tauxErreurMax?: number;   // Objectif Taux d'erreur max (ex: < 2%)
  timeoutMs?: number;       // Timeout limite
}

// Le rapport généré par k6 et stocké après l'exécution
export interface Execution {
  id?: number;
  correlationId?: string;
  testcase?: TestCase;
  dateDebut?: string;
  dateFin?: string;
  statut?: TestStatus;      // REUSSIE ou ECHOUEE (calculé selon le respect des seuils)
  
  // --- Données extraites du rapport k6 ---
  p95MesureMs?: number;      // Valeur P95 réellement mesurée (ex: 850 ms)
  tauxErreurMesure?: number; // Taux d'erreur réel (ex: 0.8%)
  reqTotal?: number;         // Nombre total de requêtes
  rpsMoyen?: number;         // Requêtes par seconde
  rapportK6Json?: string;    // Contenu brut du rapport pour détails
}

export interface Campaign {
  id?: number;
  nom: string;
  description?: string;
  testcase?: TestCase[];
  configurationCharge?: string;
  statut?: TestStatus;
}

