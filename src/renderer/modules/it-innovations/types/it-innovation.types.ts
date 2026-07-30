export type ItInnovationStatus =
  | 'PHASE1_EN_ATTENTE'
  | 'PHASE1_REJETEE'
  | 'PHASE2_EN_COURS'
  | 'PHASE2_EN_ATTENTE'
  | 'PHASE2_REJETEE'
  | 'PHASE3_EN_COURS'
  | 'PHASE3_EN_ATTENTE'
  | 'PHASE3_REJETEE'
  | 'VALIDEE';

export interface ItInnovationEmployee {
  id: number;
  firstName: string;
  lastName: string;
  matricule: string;
  poste: string | null;
}

export interface ItInnovationAttachment {
  id: number;
  name: string;
  type: string;
  size: number;
  numeroArchive: string | null;
  itInnovationPhase: 1 | 2 | 3 | null;
  uploadedAt: string;
}

export interface ItInnovation {
  id: number;
  uuid: string;
  reference: string;
  title: string;
  employeeId: number;
  employee?: ItInnovationEmployee;
  createdById: number | null;
  createdByName?: string | null;
  status: ItInnovationStatus;
  progress: number;
  phase1Description: string;
  phase1ValidatedById: number | null;
  phase1ValidatedByName?: string | null;
  phase1ValidatedAt: string | null;
  phase1RejectedAt: string | null;
  phase1RejectionReason: string | null;
  phase2Description: string | null;
  phase2SubmittedAt: string | null;
  phase2ValidatedById: number | null;
  phase2ValidatedByName?: string | null;
  phase2ValidatedAt: string | null;
  phase2RejectedAt: string | null;
  phase2RejectionReason: string | null;
  phase3Description: string | null;
  phase3SubmittedAt: string | null;
  phase3ValidatedById: number | null;
  phase3ValidatedByName?: string | null;
  phase3ValidatedAt: string | null;
  phase3RejectedAt: string | null;
  phase3RejectionReason: string | null;
  notes: string | null;
  attachments?: ItInnovationAttachment[];
  _count?: { attachments: number };
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export const STATUS_LABEL: Record<ItInnovationStatus, string> = {
  PHASE1_EN_ATTENTE: 'Phase 1 — en attente de validation',
  PHASE1_REJETEE: 'Phase 1 — rejetée (à réviser)',
  PHASE2_EN_COURS: 'Phase 2 — à compléter',
  PHASE2_EN_ATTENTE: 'Phase 2 — en attente de validation',
  PHASE2_REJETEE: 'Phase 2 — rejetée (à réviser)',
  PHASE3_EN_COURS: 'Phase 3 — à compléter',
  PHASE3_EN_ATTENTE: 'Phase 3 — en attente de validation',
  PHASE3_REJETEE: 'Phase 3 — rejetée (à réviser)',
  VALIDEE: 'Validée — mise en œuvre',
};

export const STATUS_BADGE_VARIANT: Record<ItInnovationStatus, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'> = {
  PHASE1_EN_ATTENTE: 'info',
  PHASE1_REJETEE: 'danger',
  PHASE2_EN_COURS: 'warning',
  PHASE2_EN_ATTENTE: 'info',
  PHASE2_REJETEE: 'danger',
  PHASE3_EN_COURS: 'warning',
  PHASE3_EN_ATTENTE: 'info',
  PHASE3_REJETEE: 'danger',
  VALIDEE: 'success',
};
