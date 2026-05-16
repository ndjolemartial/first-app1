import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';

const ipc = window.electron.archiving;

export function useArchives(filters: object = {}, page = 1, limit = 30) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['archives', filters, page],
    queryFn: () => ipc.list(token, filters, page, limit),
  });
}

export function useArchive(id: number) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['archives', id],
    queryFn: () => ipc.getById(token, id),
    enabled: id > 0,
  });
}

export function useArchiveStats() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['archive-stats'],
    queryFn: () => ipc.getStats(token),
  });
}

export function useArchiveEntity() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc.archive(token, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['archives'] });
      qc.invalidateQueries({ queryKey: ['archive-stats'] });
    },
  });
}

export function useRestoreArchive() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc.restore(token, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['archives'] });
      qc.invalidateQueries({ queryKey: ['archive-stats'] });
    },
  });
}

export function usePermanentDelete() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc.permanentDelete(token, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['archives'] });
      qc.invalidateQueries({ queryKey: ['archive-stats'] });
    },
  });
}

export function usePolicies() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['archive-policies'],
    queryFn: () => ipc.listPolicies(token),
  });
}

export function useCreatePolicy() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc.createPolicy(token, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['archive-policies'] }),
  });
}

export function useUpdatePolicy() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) =>
      ipc.updatePolicy(token, id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['archive-policies'] }),
  });
}

export function useDeletePolicy() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc.deletePolicy(token, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['archive-policies'] }),
  });
}
