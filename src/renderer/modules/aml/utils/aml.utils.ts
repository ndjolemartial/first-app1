export const RISK_LEVEL_LABEL: Record<string, string> = {
  FAIBLE: 'Faible',
  MOYEN: 'Moyen',
  ELEVE: 'Élevé',
};

export const RISK_LEVEL_VARIANT: Record<string, 'success' | 'warning' | 'danger'> = {
  FAIBLE: 'success',
  MOYEN: 'warning',
  ELEVE: 'danger',
};

export const PROFILE_STATUS_LABEL: Record<string, string> = {
  EN_COURS: 'En cours',
  VALIDE: 'Validé',
  A_REVOIR: 'À revoir',
  REFUSE: 'Refusé',
};

export const PROFILE_STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  EN_COURS: 'default',
  VALIDE: 'success',
  A_REVOIR: 'warning',
  REFUSE: 'danger',
};

export const VIGILANCE_TYPE_LABEL: Record<string, string> = {
  SIMPLIFIEE: 'Simplifiée',
  NORMALE: 'Normale',
  RENFORCEE: 'Renforcée',
};

export const PEP_CATEGORY_LABEL: Record<string, string> = {
  PEP_NATIONAL: 'PPE nationale',
  PEP_ETRANGER: 'PPE étrangère',
  PEP_ORGANISATION_INTERNATIONALE: "PPE d'organisation internationale",
  PERSONNE_LIEE_PEP: 'Proche/associé de PPE',
};

export const WATCHLIST_TYPE_LABEL: Record<string, string> = {
  ONU: 'ONU',
  UE: 'Union européenne',
  NATIONALE: 'Liste nationale',
  GIABA: 'GIABA',
  AUTRE: 'Autre',
};

export const WATCHLIST_MATCH_STATUS_LABEL: Record<string, string> = {
  A_VERIFIER: 'À vérifier',
  CONFIRME: 'Confirmé',
  FAUX_POSITIF: 'Faux positif',
};

export const WATCHLIST_MATCH_STATUS_VARIANT: Record<string, 'default' | 'success' | 'danger'> = {
  A_VERIFIER: 'default',
  CONFIRME: 'danger',
  FAUX_POSITIF: 'success',
};

export const REVIEW_TRIGGER_LABEL: Record<string, string> = {
  SEUIL_MONTANT: 'Seuil de montant dépassé',
  RISQUE_ELEVE: 'Profil à risque élevé',
  PEP: 'Personne politiquement exposée',
  PAYS_RISQUE: 'Lien avec un pays à risque',
  ESPECES: 'Paiement en espèces',
  WATCHLIST: 'Correspondance liste de vigilance',
  MANUEL: 'Déclenchement manuel',
};

export const REVIEW_STATUS_LABEL: Record<string, string> = {
  OUVERTE: 'Ouverte',
  EN_COURS: 'En cours',
  CLOTUREE_RAS: 'Clôturée — RAS',
  CLOTUREE_DECLAREE: 'Clôturée — déclarée',
};

export const REVIEW_STATUS_VARIANT: Record<string, 'default' | 'warning' | 'success' | 'danger'> = {
  OUVERTE: 'warning',
  EN_COURS: 'warning',
  CLOTUREE_RAS: 'success',
  CLOTUREE_DECLAREE: 'danger',
};

// Libellé de la source réelle de l'encaissement ayant déclenché/motivé la
// revue — un paiement de facture, une échéance de convention, ou une
// échéance héritée (convention absente sur l'échéance).
export function reviewSourceLabel(review: { sourceType?: string | null; conventionId?: number | null }): string {
  if (review.sourceType === 'PAYMENT') return 'Paiement de facture';
  if (review.sourceType === 'INSTALLMENT') return review.conventionId ? 'Échéance de convention' : 'Échéance héritée';
  if (review.sourceType === 'INVOICE') return 'Facture réglée directement';
  return 'Non précisée';
}

// Variante de badge associée : les encaissements « réglés directement »
// (facture basculée en Payée sans ligne de paiement enregistrée) méritent
// une attention particulière, la traçabilité du règlement étant plus faible.
export function reviewSourceBadgeVariant(review: { sourceType?: string | null; conventionId?: number | null }): 'default' | 'warning' {
  if (review.sourceType === 'PAYMENT') return 'default';
  if (review.sourceType === 'INVOICE') return 'warning';
  return review.conventionId ? 'default' : 'warning';
}

export const REPORT_MOTIF_LABEL: Record<string, string> = {
  STRUCTURATION: 'Structuration (fractionnement)',
  ORIGINE_FONDS_SUSPECTE: 'Origine des fonds suspecte',
  INCOHERENCE_PROFIL: 'Incohérence avec le profil du client',
  MONTAGE_COMPLEXE: 'Montage complexe et inhabituel',
  PEP_NON_JUSTIFIE: 'PPE — origine non justifiée',
  WATCHLIST_CONFIRMEE: 'Correspondance liste de vigilance confirmée',
  AUTRE: 'Autre',
};

export const REPORT_STATUS_LABEL: Record<string, string> = {
  BROUILLON: 'Brouillon',
  VALIDEE_INTERNE: 'Validée en interne',
  TRANSMISE_CENTIF: 'Transmise à la CENTIF',
  CLASSEE_SANS_SUITE: 'Classée sans suite',
};

export const REPORT_STATUS_VARIANT: Record<string, 'default' | 'warning' | 'danger' | 'success'> = {
  BROUILLON: 'default',
  VALIDEE_INTERNE: 'warning',
  TRANSMISE_CENTIF: 'danger',
  CLASSEE_SANS_SUITE: 'success',
};

export function subjectDisplayName(subject: { type?: string; firstName?: string | null; lastName?: string | null; entreprise?: string | null; companyName?: string | null } | null | undefined): string {
  if (!subject) return '—';
  if (subject.type !== 'INDIVIDUEL') return subject.entreprise || subject.companyName || `${subject.lastName ?? ''} ${subject.firstName ?? ''}`.trim() || '—';
  return `${subject.lastName ?? ''} ${subject.firstName ?? ''}`.trim() || subject.companyName || subject.entreprise || '—';
}
