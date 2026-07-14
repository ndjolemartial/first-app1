export interface PhoneCall {
  id: number;
  uuid: string;
  direction: 'ENTRANT' | 'SORTANT';
  ligne?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  phone: string;
  email?: string | null;
  objet: string;
  details?: string | null;
  duration?: number | null;
  status: 'ABOUTI' | 'MANQUE' | 'OCCUPE' | 'MESSAGE_LAISSE';
  calledAt: string;
  clientId?: number | null;
  prospectId?: number | null;
  createdById?: number | null;
  createdBy?: { id: number; firstName: string; lastName: string } | null;
  client?: { id: number; firstName: string | null; lastName: string | null; entreprise: string | null; type: string } | null;
  prospect?: { id: number; firstName: string; lastName: string } | null;
  createdAt: string;
  updatedAt: string;
}

export const DIRECTION_LABEL: Record<string, string> = {
  ENTRANT: 'Entrant',
  SORTANT: 'Sortant',
};

export const STATUS_LABEL: Record<string, string> = {
  ABOUTI: 'Abouti',
  MANQUE: 'Manqué',
  OCCUPE: 'Occupé',
  MESSAGE_LAISSE: 'Message laissé',
};
