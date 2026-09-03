export type AmlSubjectType = 'CLIENT' | 'OWNER';
export type AmlRiskLevel = 'FAIBLE' | 'MOYEN' | 'ELEVE';
export type AmlVigilanceType = 'SIMPLIFIEE' | 'NORMALE' | 'RENFORCEE';
export type AmlReviewStatus = 'EN_COURS' | 'VALIDE' | 'A_REVOIR' | 'REFUSE';
export type AmlPepCategory = 'PEP_NATIONAL' | 'PEP_ETRANGER' | 'PEP_ORGANISATION_INTERNATIONALE' | 'PERSONNE_LIEE_PEP';
export type AmlWatchlistType = 'ONU' | 'UE' | 'NATIONALE' | 'GIABA' | 'AUTRE';
export type AmlWatchlistPersonType = 'PHYSIQUE' | 'MORALE';
export type AmlWatchlistMatchStatus = 'A_VERIFIER' | 'CONFIRME' | 'FAUX_POSITIF';
export type AmlMaritalStatus = 'CELIBATAIRE' | 'MARIEE' | 'CONCUBINAGE' | 'DIVORCE' | 'VEUF';
export type AmlReviewTriggerReason = 'SEUIL_MONTANT' | 'RISQUE_ELEVE' | 'PEP' | 'PAYS_RISQUE' | 'ESPECES' | 'WATCHLIST' | 'MANUEL';
export type AmlTransactionReviewStatus = 'OUVERTE' | 'EN_COURS' | 'CLOTUREE_RAS' | 'CLOTUREE_DECLAREE';
export type AmlSuspiciousMotifCategory = 'STRUCTURATION' | 'ORIGINE_FONDS_SUSPECTE' | 'INCOHERENCE_PROFIL' | 'MONTAGE_COMPLEXE' | 'PEP_NON_JUSTIFIE' | 'WATCHLIST_CONFIRMEE' | 'AUTRE';
export type AmlSuspiciousReportStatus = 'BROUILLON' | 'VALIDEE_INTERNE' | 'TRANSMISE_CENTIF' | 'CLASSEE_SANS_SUITE';

export interface AmlSubjectSummary {
  id: number;
  type?: string;
  firstName?: string | null;
  lastName?: string | null;
  entreprise?: string | null;
  companyName?: string | null;
  nationality?: string | null;
  idNumber?: string | null;
  birthDate?: string | null;
  country?: string | null;
}

export interface AmlBeneficialOwner {
  id: number;
  profileId: number;
  firstName: string;
  lastName: string;
  nationality?: string | null;
  idNumber?: string | null;
  ownershipPct?: number | null;
  role?: string | null;
  isPep: boolean;
  notes?: string | null;
}

export interface AmlRiskFactorCatalog {
  id: number;
  code: string;
  label: string;
  category?: string | null;
  weight: number;
  isAutoDetected: boolean;
  description?: string | null;
  isActive: boolean;
}

export interface AmlProfileRiskFactorLink {
  id: number;
  riskFactorId: number;
  source: 'AUTO' | 'MANUEL';
  riskFactor: AmlRiskFactorCatalog;
}

export interface AmlWatchlistEntry {
  id: number;
  listType: AmlWatchlistType;
  personType: AmlWatchlistPersonType;
  name: string; // Nom et prénoms / raison sociale
  aliases?: string[] | null;
  sex?: string | null;
  nationality?: string | null;
  ages?: number[] | null;
  birthDates?: string[] | null;
  birthPlace?: string | null;
  relatedPersons?: string | null;
  maritalStatus?: AmlMaritalStatus | null;
  spokenLanguage?: string | null;
  residenceCountry?: string | null;
  address?: string | null;
  phone?: string | null;
  profession?: string | null;
  reason?: string | null;
  sourceRef?: string | null;
  notes?: string | null;
  isActive: boolean;
}

export interface AmlWatchlistMatch {
  id: number;
  profileId: number;
  watchlistId: number;
  status: AmlWatchlistMatchStatus;
  matchScore?: number | null;
  reviewedById?: number | null;
  reviewedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  watchlist: AmlWatchlistEntry;
}

export interface AmlProfile {
  id: number;
  uuid: string;
  reference: string;
  subjectType: AmlSubjectType;
  subjectId: number;
  subject?: AmlSubjectSummary | null;
  riskScore: number;
  riskLevel: AmlRiskLevel;
  vigilanceType: AmlVigilanceType;
  isPep: boolean;
  pepCategory?: AmlPepCategory | null;
  pepFunction?: string | null;
  hasRiskyCountryLink: boolean;
  sourceOfFunds?: string | null;
  sourceOfWealth?: string | null;
  status: AmlReviewStatus;
  validatedById?: number | null;
  validatedByName?: string | null;
  validatedAt?: string | null;
  nextReviewDate?: string | null;
  lastScoredAt?: string | null;
  notes?: string | null;
  createdById?: number | null;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
  beneficialOwners?: AmlBeneficialOwner[];
  riskFactorLinks?: AmlProfileRiskFactorLink[];
  watchlistMatches?: AmlWatchlistMatch[];
  documents?: any[];
}

export interface AmlProfileBadge {
  id: number;
  riskLevel: AmlRiskLevel;
  status: AmlReviewStatus;
  vigilanceType: AmlVigilanceType;
  isPep: boolean;
  updatedAt: string;
}

export type AmlReviewSourceType = 'PAYMENT' | 'INSTALLMENT' | 'INVOICE';

export interface AmlTransactionReview {
  id: number;
  uuid: string;
  reference: string;
  sourceType?: AmlReviewSourceType | null;
  sourceId?: number | null;
  conventionId?: number | null;
  sourceLabel?: string | null;
  subjectType: AmlSubjectType;
  subjectId: number;
  subject?: AmlSubjectSummary | null;
  triggerReason: AmlReviewTriggerReason;
  amount?: number | null;
  paymentMethod?: string | null;
  status: AmlTransactionReviewStatus;
  reviewedById?: number | null;
  reviewedAt?: string | null;
  conclusion?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface AmlReviewCandidate {
  sourceType: AmlReviewSourceType;
  sourceId: number;
  amount: number;
  paymentMethod?: string | null;
  conventionId?: number | null;
  clientId: number;
  label: string;
  date?: string | null;
  client?: AmlSubjectSummary | null;
}

export interface AmlReviewBadge {
  id: number;
  reference: string;
  status: AmlTransactionReviewStatus;
  triggerReason: AmlReviewTriggerReason;
}

export interface AmlTraining {
  id: number;
  uuid: string;
  reference: string;
  userId: number;
  userName?: string | null;
  trainingDate: string;
  topic: string;
  provider?: string | null;
  durationHours?: number | null;
  notes?: string | null;
  recordedById?: number | null;
  recordedByName?: string | null;
  createdAt: string;
  documents?: any[];
  _count?: { documents: number };
}

export interface AmlSuspiciousReport {
  id: number;
  uuid: string;
  reference: string;
  subjectType: AmlSubjectType;
  subjectId: number;
  subject?: AmlSubjectSummary | null;
  conventionId?: number | null;
  transactionReviewId?: number | null;
  motifCategory?: AmlSuspiciousMotifCategory | null;
  motif: string;
  status: AmlSuspiciousReportStatus;
  declaredById: number;
  declaredByName?: string | null;
  complianceOfficerId?: number | null;
  complianceOfficerName?: string | null;
  transmittedById?: number | null;
  transmittedByName?: string | null;
  transmittedAt?: string | null;
  centifReference?: string | null;
  classificationReason?: string | null;
  notes?: string | null;
  createdAt: string;
}
