import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';

const ipc = window.electron.commissions;

/** Invalide l'ensemble des données du module commissions après une mutation. */
function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['commissions'] });
}

/* ─── Commissions ─────────────────────────────────────────────────── */

export function useCommissionsDashboard() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['commissions', 'dashboard'],
    queryFn: () => ipc.getDashboard(token),
  });
}

export function useCommissions(filters: object = {}, page = 1, limit = 20) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['commissions', 'list', filters, page],
    queryFn: () => ipc.list(token, filters, page, limit),
  });
}

export function useCommission(id: number) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['commissions', 'detail', id],
    queryFn: () => ipc.getById(token, id),
    enabled: id > 0,
  });
}

export function useCreateCommission() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc.create(token, payload),
    onSuccess: () => invalidateAll(qc),
  });
}

export function usePayCommission() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc.pay(token, payload),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useCancelCommission() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc.cancel(token, payload),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useBeneficiarySummary(beneficiaryType: string, beneficiaryId: number) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['commissions', 'beneficiary', beneficiaryType, beneficiaryId],
    queryFn: () => ipc.getBeneficiarySummary(token, beneficiaryType, beneficiaryId),
    enabled: beneficiaryId > 0 && !!beneficiaryType,
  });
}

/* ─── Apporteurs d'affaire ────────────────────────────────────────── */

export function useReferrers(filters: object = {}, page = 1, limit = 20) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['commissions', 'referrers', filters, page],
    queryFn: () => ipc.listReferrers(token, filters, page, limit),
  });
}

export function useReferrer(id: number) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['commissions', 'referrer', id],
    queryFn: () => ipc.getReferrerById(token, id),
    enabled: id > 0,
  });
}

export function useCreateReferrer() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc.createReferrer(token, payload),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateReferrer() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc.updateReferrer(token, id, payload),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteReferrer() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc.deleteReferrer(token, id),
    onSuccess: () => invalidateAll(qc),
  });
}

/* ─── Données de formulaire & paramètres ──────────────────────────── */

export function useCommissionUsers() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['commissions', 'users'],
    queryFn: () => ipc.listUsers(token),
  });
}

export function useEligibleConventions() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['commissions', 'eligible-conventions'],
    queryFn: () => ipc.listEligibleConventions(token),
  });
}

export function useCommissionSettings() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['commissions', 'settings'],
    queryFn: () => ipc.getSettings(token),
  });
}

export function useUpdateCommissionSettings() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc.updateSettings(token, payload),
    onSuccess: () => invalidateAll(qc),
  });
}
