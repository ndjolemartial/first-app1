export type BudgetStatus = 'OUVERT' | 'CLOTURE';

export interface BudgetUser {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
  matricule?: string | null;
}

export interface BudgetLineEvolution {
  spent: number;
  remaining: number;
  consumptionRate: number;
  operationsCount: number;
}

export interface BudgetLine extends BudgetLineEvolution {
  id: number;
  uuid: string;
  budgetId: number;
  code: string | null;
  label: string;
  description: string | null;
  allocatedAmount: string | number;
  managerId: number | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  manager?: BudgetUser | null;
  budget?: {
    id: number;
    reference: string;
    name: string;
    status: BudgetStatus;
    periodStart?: string;
    periodEnd?: string;
  };
}

export interface Budget {
  id: number;
  uuid: string;
  reference: string;
  name: string;
  description: string | null;
  periodStart: string;
  periodEnd: string;
  totalAllocated: string | number | null;
  status: BudgetStatus;
  closingSnapshot: unknown;
  closedAt: string | null;
  closedById: number | null;
  closedBy?: BudgetUser | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Statistiques agrégées (dashboard / list)
  totalLines?: number;
  activeLines?: number;
  totalAllocated_agg?: number;
  totalSpent?: number;
  totalRemaining?: number;
  consumptionRate?: number;
  // Détail (getById)
  lines?: BudgetLine[];
  summary?: {
    totalAllocated: number;
    totalSpent: number;
    totalRemaining: number;
    linesCount: number;
    operationsCount: number;
    periodStart: string;
    periodEnd: string;
  };
}

export interface BudgetDashboard {
  budgets: Budget[];
  lines: BudgetLine[];
  stats: {
    budgetsCount: number;
    openBudgets: number;
    closedBudgets: number;
    linesCount: number;
    activeLines: number;
    totalAllocated: number;
    totalSpent: number;
    totalRemaining: number;
  };
}
