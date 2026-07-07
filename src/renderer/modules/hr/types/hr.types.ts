// Types et libellés du module RH / Paie (Phase 1 : personnel & contrats).

export interface Employee {
  id: number;
  matricule: string;
  civilite?: string | null;
  firstName: string;
  lastName: string;
  sexe?: string | null;
  birthDate?: string | null;
  birthPlace?: string | null;
  nationality?: string | null;
  maritalStatus?: string | null;
  childrenCount: number;
  igrParts?: number | string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  address?: string | null;
  city?: string | null;
  idNumber?: string | null;
  cnpsNumber?: string | null;
  cmuNumber?: string | null;
  bankName?: string | null;
  bankRib?: string | null;
  poste?: string | null;
  departement?: string | null;
  userId?: number | null;
  status: string;
  hireDate?: string | null;
  exitDate?: string | null;
  exitReason?: string | null;
  notes?: string | null;
  contracts?: EmploymentContract[];
  createdAt?: string;
}

export interface EmploymentContract {
  id: number;
  reference: string;
  employeeId: number;
  type: string;
  status: string;
  poste?: string | null;
  categorie?: string | null;
  startDate: string;
  endDate?: string | null;
  trialEndDate?: string | null;
  weeklyHours?: number | string | null;
  baseSalary: number | string;
  sursalaire?: number | string | null;
  primeAnciennete?: number | string | null;
  grossSalary?: number | string | null;
  its?: number | string | null;
  cnps?: number | string | null;
  cmu?: number | string | null;
  totalDeductions?: number | string | null;
  transportAllowance?: number | string | null;
  netSalary?: number | string | null;
  // Avenant CDD : contrat CDD initial rattaché.
  parentContractId?: number | null;
  // Autorité responsable : employé signataire/responsable au titre du contrat.
  responsibleAuthorityId?: number | null;
  // Fonction de l'employé (référentiel paramétrable).
  functionId?: number | null;
  // Objectifs assignés (référentiel paramétrable).
  objectiveId?: number | null;
  // Commissions sur activité (instantané libellé + taux) pour ce contrat.
  activityCommissions?: ActivityCommission[] | null;
  notes?: string | null;
}

/** Ligne de commission sur activité retenue pour un contrat (instantané). */
export interface ActivityCommission {
  key: string;
  label: string;
  rate: number;
}

/** Ligne du catalogue de commissions sur activité (avec taux par défaut). */
export interface CommissionActivityOption {
  key: string;
  label: string;
  defaultRate: number;
}

export const CIVILITE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'MONSIEUR', label: 'Monsieur' },
  { value: 'MADAME', label: 'Madame' },
  { value: 'MADEMOISELLE', label: 'Mademoiselle' },
];

export const SEXE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'MASCULIN', label: 'Masculin' },
  { value: 'FEMININ', label: 'Féminin' },
];

export const MARITAL_OPTIONS = [
  { value: '', label: '—' },
  { value: 'CELIBATAIRE', label: 'Célibataire' },
  { value: 'MARIEE', label: 'Marié(e)' },
  { value: 'CONCUBINAGE', label: 'Concubinage' },
  { value: 'DIVORCE', label: 'Divorcé(e)' },
  { value: 'VEUF', label: 'Veuf/Veuve' },
];

export const EMPLOYEE_STATUS_OPTIONS = [
  { value: 'ACTIF', label: 'Actif' },
  { value: 'SUSPENDU', label: 'Suspendu' },
  { value: 'CONGE', label: 'En congé' },
  { value: 'SORTI', label: 'Sorti des effectifs' },
];

export const EMPLOYEE_STATUS_LABEL: Record<string, string> = {
  ACTIF: 'Actif', SUSPENDU: 'Suspendu', CONGE: 'En congé', SORTI: 'Sorti',
};

export const EMPLOYEE_STATUS_VARIANT: Record<string, string> = {
  ACTIF: 'success', SUSPENDU: 'warning', CONGE: 'info', SORTI: 'default',
};

export const CONTRACT_TYPE_OPTIONS = [
  { value: 'CDI', label: 'CDI' },
  { value: 'CDD', label: 'CDD' },
  { value: 'STAGE', label: 'Stage' },
  { value: 'INTERIM', label: 'Intérim' },
  { value: 'CONSULTANT', label: 'Consultant' },
  { value: 'APPRENTISSAGE', label: 'Apprentissage' },
  { value: 'ESSAI', label: 'Essai' },
  { value: 'AVENANT_CDD', label: 'Avenant CDD' },
  { value: 'RENOUVELLEMENT_ESSAI', label: 'Lettre de renouvellement ESSAI' },
];

export const CONTRACT_TYPE_LABEL: Record<string, string> = {
  CDI: 'CDI', CDD: 'CDD', STAGE: 'Stage', INTERIM: 'Intérim',
  CONSULTANT: 'Consultant', APPRENTISSAGE: 'Apprentissage', ESSAI: 'Essai',
  AVENANT_CDD: 'Avenant CDD', RENOUVELLEMENT_ESSAI: 'Lettre de renouvellement ESSAI',
};

export interface EssaiCategory {
  id: number;
  label: string;
  durationValue: number;
  durationUnit: 'JOURS' | 'MOIS';
  isActive: boolean;
}

export const CONTRACT_STATUS_OPTIONS = [
  { value: 'BROUILLON', label: 'Brouillon' },
  { value: 'ACTIF', label: 'Actif' },
  { value: 'SUSPENDU', label: 'Suspendu' },
  { value: 'TERMINE', label: 'Terminé' },
  { value: 'ROMPU', label: 'Rompu' },
];

export const CONTRACT_STATUS_LABEL: Record<string, string> = {
  BROUILLON: 'Brouillon', ACTIF: 'Actif', SUSPENDU: 'Suspendu',
  TERMINE: 'Terminé', ROMPU: 'Rompu',
};

export const CONTRACT_STATUS_VARIANT: Record<string, string> = {
  BROUILLON: 'default', ACTIF: 'success', SUSPENDU: 'warning',
  TERMINE: 'default', ROMPU: 'danger',
};

export interface PayslipLine {
  id: number;
  type: 'GAIN' | 'RETENUE' | 'CHARGE_PATRONALE' | 'INFO';
  label: string;
  base?: number | string | null;
  rate?: number | string | null;
  amount: number | string;
  order: number;
}

export interface Payslip {
  id: number;
  reference: string;
  employeeId: number;
  contractId?: number | null;
  periodYear: number;
  periodMonth: number;
  baseSalary: number | string;
  grossTaxable: number | string;
  totalGains: number | string;
  cnpsEmployee: number | string;
  its: number | string;
  cmuEmployee: number | string;
  otherDeductions: number | string;
  totalDeductions: number | string;
  netSalary: number | string;
  employerCharges: number | string;
  employerCost: number | string;
  status: string;
  paidAt?: string | null;
  paymentMethod?: string | null;
  employee?: { id: number; matricule: string; firstName: string; lastName: string };
  contract?: { id: number; reference: string; poste?: string | null } | null;
  lines?: PayslipLine[];
}

export const PAYSLIP_STATUS_OPTIONS = [
  { value: 'BROUILLON', label: 'Brouillon' },
  { value: 'VALIDE', label: 'Validé' },
  { value: 'PAYE', label: 'Payé' },
  { value: 'ANNULE', label: 'Annulé' },
];

export const PAYSLIP_STATUS_LABEL: Record<string, string> = {
  BROUILLON: 'Brouillon', VALIDE: 'Validé', PAYE: 'Payé', ANNULE: 'Annulé',
};

export const PAYSLIP_STATUS_VARIANT: Record<string, string> = {
  BROUILLON: 'default', VALIDE: 'info', PAYE: 'success', ANNULE: 'danger',
};

export const MONTH_OPTIONS = [
  { value: '1', label: 'Janvier' }, { value: '2', label: 'Février' }, { value: '3', label: 'Mars' },
  { value: '4', label: 'Avril' }, { value: '5', label: 'Mai' }, { value: '6', label: 'Juin' },
  { value: '7', label: 'Juillet' }, { value: '8', label: 'Août' }, { value: '9', label: 'Septembre' },
  { value: '10', label: 'Octobre' }, { value: '11', label: 'Novembre' }, { value: '12', label: 'Décembre' },
];

export const MONTH_LABEL: Record<number, string> = {
  1: 'Janvier', 2: 'Février', 3: 'Mars', 4: 'Avril', 5: 'Mai', 6: 'Juin',
  7: 'Juillet', 8: 'Août', 9: 'Septembre', 10: 'Octobre', 11: 'Novembre', 12: 'Décembre',
};

export const PAYMENT_METHOD_OPTIONS = [
  { value: 'VIREMENT', label: 'Virement' },
  { value: 'TRANSFERT', label: 'Transfert' },
  { value: 'ESPECE', label: 'Espèces' },
  { value: 'CHEQUE', label: 'Chèque' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
];

export interface LeaveType {
  id: number; code: string; name: string; isPaid: boolean; affectsBalance: boolean; color?: string | null;
}

export interface LeaveRequest {
  id: number; reference: string; employeeId: number; typeId: number;
  startDate: string; endDate: string; days: number | string; reason?: string | null;
  status: string; decisionNote?: string | null;
  employee?: { id: number; matricule: string; firstName: string; lastName: string };
  type?: { id: number; name: string; color?: string | null; isPaid: boolean };
}

export const LEAVE_STATUS_OPTIONS = [
  { value: 'EN_ATTENTE', label: 'En attente' },
  { value: 'APPROUVE', label: 'Approuvé' },
  { value: 'REFUSE', label: 'Refusé' },
  { value: 'ANNULE', label: 'Annulé' },
];

export const LEAVE_STATUS_LABEL: Record<string, string> = {
  EN_ATTENTE: 'En attente', APPROUVE: 'Approuvé', REFUSE: 'Refusé', ANNULE: 'Annulé',
};

export const LEAVE_STATUS_VARIANT: Record<string, string> = {
  EN_ATTENTE: 'warning', APPROUVE: 'success', REFUSE: 'danger', ANNULE: 'default',
};
