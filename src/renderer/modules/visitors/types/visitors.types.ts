export interface Visitor {
  id: number;
  uuid: string;
  firstName: string;
  lastName: string;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  objet: string;
  details?: string | null;
  visitedAt: string;
  source: 'QR' | 'INTERNE';
  createdById?: number | null;
  createdBy?: { id: number; firstName: string; lastName: string } | null;
  createdAt: string;
  updatedAt: string;
}

export const SOURCE_LABEL: Record<string, string> = {
  QR: 'QR Code',
  INTERNE: 'Accueil',
};
