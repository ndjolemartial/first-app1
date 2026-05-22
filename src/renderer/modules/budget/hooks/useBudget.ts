import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';

const ipc = window.electron.budget;

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['budget'] });
  qc.invalidateQueries({ queryKey: ['treasury'] });
}

/* ─── Tableau de bord ─────────────────────────────────────────────── */

export function useBudgetDashboard() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['budget', 'dashboard'],
    queryFn: () => ipc.getDashboard(token),
  });
}

/* ─── Budgets ─────────────────────────────────────────────────────── */

export function useBudgets(filters: object = {}) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['budget', 'list', filters],
    queryFn: () => ipc.list(token, filters),
  });
}

export function useBudget(id: number) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['budget', 'detail', id],
    queryFn: () => ipc.getById(token, id),
    enabled: id > 0,
  });
}

export function useCreateBudget() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc.create(token, payload),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateBudget() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc.update(token, id, payload),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useCloseBudget() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc.close(token, id),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useReopenBudget() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc.reopen(token, id),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteBudget() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc.delete(token, id),
    onSuccess: () => invalidateAll(qc),
  });
}

/* ─── Lignes budgétaires ──────────────────────────────────────────── */

export function useBudgetLines(filters: object = {}) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['budget', 'lines', filters],
    queryFn: () => ipc.listLines(token, filters),
  });
}

export function useBudgetLine(id: number) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['budget', 'line', id],
    queryFn: () => ipc.getLineById(token, id),
    enabled: id > 0,
  });
}

export function useCreateBudgetLine() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc.createLine(token, payload),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateBudgetLine() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc.updateLine(token, id, payload),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useToggleBudgetLineActive() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc.toggleLineActive(token, id),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteBudgetLine() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc.deleteLine(token, id),
    onSuccess: () => invalidateAll(qc),
  });
}

/* ─── Auxiliaires ─────────────────────────────────────────────────── */

export function useEligibleManagers() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['budget', 'managers'],
    queryFn: () => ipc.listEligibleManagers(token),
  });
}

/** Lignes budgétaires accessibles à l'utilisateur courant (pour imputer une sortie). */
export function useAccessibleBudgetLines() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['budget', 'accessible'],
    queryFn: () => ipc.listAccessibleLines(token),
  });
}
