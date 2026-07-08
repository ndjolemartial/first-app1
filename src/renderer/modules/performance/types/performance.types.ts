// Types & libellés du module Évaluation & gestion des performances (Module 14).

export type KpiSource = 'SALES' | 'COMMISSIONS' | 'ACCOUNTING' | 'CRM' | 'PROSPECTS' | 'ATTENDANCE' | 'LEAVE' | 'PROJECT' | 'MANUAL';
export type KpiMetric =
  | 'SALES_COUNT' | 'SALES_AMOUNT' | 'RESILIATION_COUNT' | 'COMMISSION_AMOUNT' | 'ENCAISSEMENT_AMOUNT'
  | 'CRM_ACTIVITIES_DONE' | 'CRM_VISITS' | 'CRM_CALLS' | 'PROSPECT_CONVERSION_RATE'
  | 'ATTENDANCE_RATE' | 'OVERTIME_HOURS' | 'ABSENCE_DAYS' | 'MANUAL_VALUE';
export type KpiDirection = 'HIGHER_BETTER' | 'LOWER_BETTER';
export type PerfCycleType = 'ANNUEL' | 'TRIMESTRIEL';
export type ObjectiveStatus = 'EN_COURS' | 'ATTEINT' | 'PARTIEL' | 'NON_ATTEINT' | 'ANNULE';
export type EvaluationStatus =
  | 'BROUILLON' | 'SOUMISE' | 'VALIDEE_RESPONSABLE' | 'VALIDEE_COLLABORATEUR'
  | 'VALIDEE_DIRECTION' | 'CLOTUREE' | 'REFUSEE';
export type ProgressPlanStatus = 'EN_COURS' | 'REALISE' | 'ABANDONNE';
export type RankingPeriodType = 'SEMAINE' | 'MOIS' | 'TRIMESTRE' | 'SEMESTRE' | 'ANNEE';

export interface KpiDefinition {
  id: number;
  code: string;
  label: string;
  category: string | null;
  source: KpiSource;
  metric: KpiMetric;
  unit: string | null;
  direction: KpiDirection;
  defaultTarget: number | null;
  description: string | null;
  isActive: boolean;
}

export interface WeightProfile {
  id: number;
  poste: string;
  name: string;
  isActive: boolean;
  lines: Array<{ id: number; kpiDefinitionId: number; weight: number; kpiDefinition?: { id: number; label: string; code: string } }>;
}

export interface PerfEmployee {
  id: number;
  matricule: string;
  firstName: string;
  lastName: string;
  poste: string | null;
  departement: string | null;
  userId: number | null;
  status?: string;
}

export interface Objective {
  id: number;
  employeeId: number | null;
  poste: string | null;
  cycleType: PerfCycleType;
  year: number;
  quarter: number | null;
  title: string;
  description: string | null;
  weight: number;
  targetValue: number | null;
  unit: string | null;
  kpiDefinitionId: number | null;
  measureType: 'AUTO' | 'MANUAL';
  progress: number;
  status: ObjectiveStatus;
  employee?: PerfEmployee;
  kpiDefinition?: { id: number; label: string; unit: string | null } | null;
}

export interface EvaluationLine {
  id: number;
  objectiveId: number | null;
  kpiDefinitionId: number | null;
  label: string;
  weight: number;
  targetValue: number | null;
  actualValue: number | null;
  score: number | null;
  comment: string | null;
  kpiDefinition?: { id: number; label: string; unit: string | null } | null;
}

export interface Evaluation {
  id: number;
  reference: string;
  employeeId: number;
  cycleType: PerfCycleType;
  year: number;
  quarter: number | null;
  evaluatorId: number | null;
  globalScore: number | null;
  status: EvaluationStatus;
  managerSignedAt: string | null;
  employeeSignedAt: string | null;
  directionSignedAt: string | null;
  refusalReason: string | null;
  strengths: string | null;
  areasToImprove: string | null;
  comments: string | null;
  employee?: PerfEmployee;
  evaluator?: { id: number; firstName: string; lastName: string } | null;
  lines?: EvaluationLine[];
  plans?: ProgressPlan[];
}

export interface ProgressPlan {
  id: number;
  evaluationId: number | null;
  employeeId: number;
  title: string;
  actions: string | null;
  trainingNeeds: string | null;
  dueDate: string | null;
  status: ProgressPlanStatus;
  followUpNotes: string | null;
  employee?: { id: number; firstName: string; lastName: string; matricule: string };
}

export interface RankingEntry {
  employeeId: number;
  employeeName: string;
  matricule: string;
  poste: string | null;
  departement: string | null;
  score: number;
  rank: number;
  linked: boolean;
}

// ── Libellés ─────────────────────────────────────────────────────────────────

export const KPI_SOURCE_LABEL: Record<KpiSource, string> = {
  SALES: 'Ventes / conventions',
  COMMISSIONS: 'Commissions',
  ACCOUNTING: 'Encaissements',
  CRM: 'Activités CRM',
  PROSPECTS: 'Prospection',
  ATTENDANCE: 'Assiduité / pointage',
  LEAVE: 'Congés / absences',
  PROJECT: 'Projets (service)',
  MANUAL: 'Saisie manuelle',
};

export const KPI_METRIC_LABEL: Record<KpiMetric, string> = {
  SALES_COUNT: 'Nombre de ventes signées',
  SALES_AMOUNT: 'Montant des ventes signées',
  RESILIATION_COUNT: 'Nombre de conventions résiliées',
  COMMISSION_AMOUNT: 'Commissions encaissées',
  ENCAISSEMENT_AMOUNT: 'Chiffre d’affaire réalisé',
  CRM_ACTIVITIES_DONE: 'Activités CRM traitées',
  CRM_VISITS: 'Visites réalisées',
  CRM_CALLS: 'Appels passés',
  PROSPECT_CONVERSION_RATE: 'Taux de conversion prospects → clients (%)',
  ATTENDANCE_RATE: 'Taux de présence (%)',
  OVERTIME_HOURS: 'Heures supplémentaires',
  ABSENCE_DAYS: 'Jours d’absence',
  MANUAL_VALUE: 'Valeur saisie manuellement',
};

/** Métriques compatibles avec chaque source (pour les sélecteurs). */
export const METRICS_BY_SOURCE: Record<KpiSource, KpiMetric[]> = {
  SALES: ['SALES_COUNT', 'SALES_AMOUNT', 'RESILIATION_COUNT'],
  COMMISSIONS: ['COMMISSION_AMOUNT'],
  ACCOUNTING: ['ENCAISSEMENT_AMOUNT'],
  CRM: ['CRM_ACTIVITIES_DONE', 'CRM_VISITS', 'CRM_CALLS'],
  PROSPECTS: ['PROSPECT_CONVERSION_RATE'],
  ATTENDANCE: ['ATTENDANCE_RATE', 'OVERTIME_HOURS', 'ABSENCE_DAYS'],
  LEAVE: ['ABSENCE_DAYS'],
  PROJECT: ['MANUAL_VALUE'],
  MANUAL: ['MANUAL_VALUE'],
};

export const OBJECTIVE_STATUS_LABEL: Record<ObjectiveStatus, string> = {
  EN_COURS: 'En cours',
  ATTEINT: 'Atteint',
  PARTIEL: 'Partiellement atteint',
  NON_ATTEINT: 'Non atteint',
  ANNULE: 'Annulé',
};

export const OBJECTIVE_STATUS_VARIANT: Record<ObjectiveStatus, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  EN_COURS: 'info',
  ATTEINT: 'success',
  PARTIEL: 'warning',
  NON_ATTEINT: 'danger',
  ANNULE: 'default',
};

export const EVAL_STATUS_LABEL: Record<EvaluationStatus, string> = {
  BROUILLON: 'Brouillon',
  SOUMISE: 'Soumise',
  VALIDEE_RESPONSABLE: 'Validée — responsable',
  VALIDEE_COLLABORATEUR: 'Validée — collaborateur',
  VALIDEE_DIRECTION: 'Validée — Direction',
  CLOTUREE: 'Clôturée',
  REFUSEE: 'Refusée',
};

export const EVAL_STATUS_VARIANT: Record<EvaluationStatus, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'> = {
  BROUILLON: 'default',
  SOUMISE: 'info',
  VALIDEE_RESPONSABLE: 'info',
  VALIDEE_COLLABORATEUR: 'purple',
  VALIDEE_DIRECTION: 'success',
  CLOTUREE: 'success',
  REFUSEE: 'danger',
};

export const PLAN_STATUS_LABEL: Record<ProgressPlanStatus, string> = {
  EN_COURS: 'En cours',
  REALISE: 'Réalisé',
  ABANDONNE: 'Abandonné',
};

export const PERIOD_LABEL: Record<RankingPeriodType, string> = {
  SEMAINE: 'Hebdomadaire',
  MOIS: 'Mensuel',
  TRIMESTRE: 'Trimestriel',
  SEMESTRE: 'Semestriel',
  ANNEE: 'Annuel',
};

export const employeeName = (e?: { firstName?: string; lastName?: string } | null): string =>
  e ? `${e.lastName ?? ''} ${e.firstName ?? ''}`.trim() : '—';
