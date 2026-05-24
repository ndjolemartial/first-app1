export type ProjectStatus = 'EN_PROJET' | 'EN_COURS' | 'SUSPENDU' | 'TERMINE' | 'ANNULE';

export interface ProjectType {
  id: number;
  code: string;
  label: string;
  description?: string | null;
  color?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { projects: number };
}

export interface Project {
  id: number;
  uuid: string;
  reference: string;
  nom: string;
  typeId: number;
  statut: ProjectStatus;
  clientId?: number | null;
  ownerId?: number | null;
  terrainId?: number | null;
  lotissementId?: number | null;
  programmeId?: number | null;
  adresse?: string | null;
  commune?: string | null;
  quartier?: string | null;
  ville?: string | null;
  pays: string;
  latitude?: number | null;
  longitude?: number | null;
  dateDebutPrevu?: string | null;
  dateDebutReel?: string | null;
  dateFinPrevue?: string | null;
  dateFinReelle?: string | null;
  avancement: number;
  budgetPrevu?: number | string | null;
  budgetRealise?: number | string | null;
  description?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  type?: ProjectType;
  client?: any;
  owner?: any;
  terrain?: any;
  lotissement?: any;
  programme?: any;
  photos?: any[];
  documents?: any[];
}

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  EN_PROJET: 'En projet',
  EN_COURS: 'En cours',
  SUSPENDU: 'Suspendu',
  TERMINE: 'Terminé',
  ANNULE: 'Annulé',
};

export const PROJECT_STATUS_VARIANT: Record<ProjectStatus, any> = {
  EN_PROJET: 'default',
  EN_COURS: 'info',
  SUSPENDU: 'warning',
  TERMINE: 'success',
  ANNULE: 'danger',
};
