export type HttpMethodType = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type TestStatus =  'EN_ATTENTE' | 'EN_COURS' | 'REUSSIE' | 'PARTIELLE' | 'ECHOUEE' | 'INTERROMPUE';
export type ExecutionMode = 'DUREE' | 'REQUETES';
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
  teststatus?: TestStatus;  // EN_ATTENTE, EN_COURS, REUSSIE, ECHOUEE, INTERROMPUE — géré par le backend, ne pas envoyer depuis le formulaire
  seuilMs?: number;         // Objectif P95 cible (ex: < 1000 ms)
  tauxErreurMax?: number;   // Objectif Taux d'erreur max (ex: < 2%)
  timeoutMs?: number;       // Timeout limite
  expectedCode?: string;    // Code HTTP attendu pour ce scénario (ex: "200", "2xx")
  JSONBody?: string;        // Corps de requête JSON — casse exacte requise par la sérialisation Jackson côté backend
  assertions?: string;      // Description des vérifications attendues
  vus?: number;             // Nombre d'utilisateurs virtuels simulés lors de l'exécution k6
  dureeSec?: number;        // Durée du test k6 en secondes — utilisé si executionMode = DUREE
  executionMode?: ExecutionMode; // DUREE (durée fixe) ou REQUETES (nombre de requêtes fixe)
  nombreRequetes?: number;  // Nombre total de requêtes — utilisé si executionMode = REQUETES
}

// Le rapport généré par k6 et stocké après l'exécution.
// Champs alignés 1:1 sur l'entité backend Execution.java.
export interface PingResult {
  id?: number;
  endpoint?: ApiEndpoint;
  pingedAt?: string;
  success: boolean;
  statusCode?: number; // absent/null when there was no HTTP response at all (timeout, DNS, etc.)
  message?: string;
}

export interface Execution {
  id?: number;
  correlationId?: string;
  testcase?: TestCase;
  dateDebut?: string;
  dateFin?: string;
  statut?: TestStatus;       // REUSSIE, PARTIELLE ou ECHOUEE (calculé selon le taux de réussite et les thresholds k6)
  p95MesureMs?: number;      // Valeur P95 réellement mesurée (ms)
  tauxErreurMesure?: number; // Taux d'erreur réel mesuré (%)
  reqTotal?: number;         // Nombre total de requêtes
  reqReussies?: number;      // Requêtes dont le code de réponse correspondait au code attendu
  reqEchouees?: number;      // Requêtes en échec (mauvais code, timeout, erreur réseau)
  rpsMoyen?: number;         // Requêtes par seconde
  vus?: number;              // VUs réellement utilisés pour ce run
  dureeSec?: number;         // Durée réellement utilisée pour ce run (secondes) — si mode DUREE
  executionMode?: ExecutionMode;
  nombreRequetes?: number;   // Nombre de requêtes réellement demandé pour ce run — si mode REQUETES
  rapportK6Json?: string;    // Rapport JSON brut produit par k6 (pour debug/détails)
  corpsReponsesJson?: string; // [{preview, count}] — corps de réponse distincts observés
}

export type AiReportSeverity = 'FAIBLE' | 'MOYEN' | 'ELEVE';

export interface AiReport {
  id?: number;
  generatedAt?: string;
  severity?: AiReportSeverity;
  summary?: string;
  strengthsJson?: string;      // JSON string array, parse client-side
  risksJson?: string;          // JSON string array, parse client-side
  recommendationsJson?: string; // JSON string array, parse client-side
  rawResponse?: string;
}

export type CampaignMode = 'PARALLELE' | 'SEQUENTIELLE';

export interface CampaignTestCaseRef {
  id?: number;
  ordre: number;
  testcase: TestCase;
}

export interface Campaign {
  id?: number;
  nom: string;
  description?: string;
  mode?: CampaignMode;
  lastLaunchedAt?: string;
  testCases?: CampaignTestCaseRef[];
}

export interface CampaignLaunch {
  id?: number;
  campaign?: Campaign;
  launchedAt?: string;
  mode?: CampaignMode;
  testCaseCount?: number;
}

// Sent on create/update — a flat ordered list of testcase ids rather than the
// full nested shape the GET responses return.
export interface CampaignRequest {
  nom: string;
  description?: string;
  mode: CampaignMode;
  testCaseIds: number[];
}