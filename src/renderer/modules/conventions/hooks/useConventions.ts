import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';

const ipc = () => window.electron.conventions;
const token = () => useAuthStore.getState().token!;

export function useConventions(filters: object = {}, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['conventions', filters, page],
    queryFn: () => ipc().list(token(), filters, page, limit),
  });
}

export function useConvention(id: number) {
  return useQuery({
    queryKey: ['convention', id],
    queryFn: () => ipc().getById(token(), id),
    enabled: id > 0,
  });
}

export function useCreateConvention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().create(token(), payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conventions'] }),
  });
}

export function useUpdateConvention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) =>
      ipc().update(token(), id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['conventions'] });
      qc.invalidateQueries({ queryKey: ['convention', id] });
    },
  });
}

export function useDeleteConvention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().delete(token(), id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conventions'] }),
  });
}

export function useConventionsStatusStats(filters: object = {}) {
  // Clé préfixée par 'conventions' afin que les invalidations existantes
  // (create/update/delete) rafraîchissent aussi les stats.
  return useQuery({
    queryKey: ['conventions', 'status-stats', filters],
    queryFn: () => ipc().statusStats(token(), filters),
  });
}

export function useGenerateInstallments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().generateInstallments(token(), id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['convention', id] });
      qc.invalidateQueries({ queryKey: ['installments', id] });
    },
  });
}

export function useInstallments(conventionId: number) {
  return useQuery({
    queryKey: ['installments', conventionId],
    queryFn: () => ipc().getInstallments(token(), conventionId),
    enabled: conventionId > 0,
  });
}

export function useUpdateInstallments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conventionId, installments }: { conventionId: number; installments: { id: number; dueDate: string; amount: number }[] }) =>
      ipc().updateInstallments(token(), conventionId, installments),
    onSuccess: (_data, { conventionId }) => {
      qc.invalidateQueries({ queryKey: ['convention', conventionId] });
      qc.invalidateQueries({ queryKey: ['installments', conventionId] });
    },
  });
}
