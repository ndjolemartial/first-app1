import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';

const ipc = window.electron.treasury;

/** Invalide l'ensemble des données du module trésorerie après une mutation. */
function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['treasury'] });
}

/* ─── Tableau de bord ─────────────────────────────────────────────── */

export function useTreasuryDashboard() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['treasury', 'dashboard'],
    queryFn: () => ipc.getDashboard(token),
  });
}

/* ─── Comptes de trésorerie ───────────────────────────────────────── */

export function useTreasuryAccounts(filters: object = {}) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['treasury', 'accounts', filters],
    queryFn: () => ipc.listAccounts(token, filters),
  });
}

export function useTreasuryAccount(id: number) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['treasury', 'account', id],
    queryFn: () => ipc.getAccountById(token, id),
    enabled: id > 0,
  });
}

export function useCreateTreasuryAccount() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc.createAccount(token, payload),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateTreasuryAccount() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc.updateAccount(token, id, payload),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteTreasuryAccount() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc.deleteAccount(token, id),
    onSuccess: () => invalidateAll(qc),
  });
}

/* ─── Opérations de trésorerie ────────────────────────────────────── */

export function useTreasuryOperations(filters: object = {}, page = 1, limit = 20) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['treasury', 'operations', filters, page],
    queryFn: () => ipc.listOperations(token, filters, page, limit),
  });
}

export function useCreateTreasuryOperation() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc.createOperation(token, payload),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateTreasuryOperation() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc.updateOperation(token, id, payload),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteTreasuryOperation() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc.deleteOperation(token, id),
    onSuccess: () => invalidateAll(qc),
  });
}

/* ─── Flux de trésorerie d'une entité analytique ──────────────────── */

/**
 * Récupère les opérations de trésorerie rattachées à un projet, un lotissement
 * ou un programme immobilier ainsi que les totaux entrées/sorties/solde net.
 */
export function useEntityCashflow(
  entityType: 'PROJECT' | 'LOTISSEMENT' | 'PROGRAMME',
  entityId: number,
  limit = 100,
) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['treasury', 'entity-cashflow', entityType, entityId, limit],
    queryFn: () => ipc.getEntityCashflow(token, entityType, entityId, limit),
    enabled: entityId > 0,
  });
}

/* ─── Objets d'opération (comptes comptables) ─────────────────────── */

export function useTreasuryCategories(filters: object = {}) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['treasury', 'categories', filters],
    queryFn: () => ipc.listCategories(token, filters),
  });
}

export function useCreateTreasuryCategory() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc.createCategory(token, payload),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateTreasuryCategory() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc.updateCategory(token, id, payload),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteTreasuryCategory() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc.deleteCategory(token, id),
    onSuccess: () => invalidateAll(qc),
  });
}

/* ─── Utilisateurs (rattachement d'un compte privé) ───────────────── */

export function useTreasuryUsers() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['treasury', 'users'],
    queryFn: () => ipc.listUsers(token),
  });
}
