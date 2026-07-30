export type HttpMethodType = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type TestStatus = 'BROUILLON' | 'EN_ATTENTE' | 'EN_COURS' | 'REUSSIE' | 'ECHOUEE' | 'INTERROMPUE';
export type authType = 'NONE' | 'BEARER' | 'OAUTH2' | 'API_KEY';

export interface ApiTarget {
  id?: number;
  nom: string;
  urlBase: string;
  authType?: authType;
  secretRef?: string;
  
  // Nouveaux champs optionnels pour les détails d'authentification
  keyName?: string;     // Pour API_KEY (ex: X-API-Key)
  keyIn?: 'HEADER' | 'QUERY'; // Pour API_KEY
  tokenUrl?: string;    // Pour OAUTH2
  clientId?: string;    // Pour OAUTH2
  
  actif?: boolean;
}
export interface ApiEndpoint {
  id?: number;
  target: { id: number } | ApiTarget;
  nom: string;
  methode: HttpMethodType;
  chemin: string;
  headers?: string;
  body?: string;
  codeAttendu?: number;
  tempsMaxMs?: number;
}

export interface TestCase {
  id?: number;
  endpoint: { id: number } | ApiEndpoint;
  nom: string;
  typeStatus?: TestStatus;  // Fonctionnel, Performance, Sécurité, Résilience
  
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

