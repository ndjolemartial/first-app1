import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';

const ipc = window.electron.crm;

export function useActivities(filters: object = {}, page = 1, limit = 30) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['crm-activities', filters, page],
    queryFn: () => ipc.listActivities(token, filters, page, limit),
  });
}

export function useActivity(id: number) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['crm-activities', id],
    queryFn: () => ipc.getActivity(token, id),
    enabled: id > 0,
  });
}

export function useCrmStats(filters: object = {}) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['crm-stats', filters],
    queryFn: () => ipc.getStats(token, filters),
  });
}

export function useCrmAssignees(enabled = true) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['crm-assignees'],
    queryFn: () => ipc.listAssignees(token),
    enabled: !!token && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateActivity() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc.createActivity(token, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-activities'] });
      qc.invalidateQueries({ queryKey: ['crm-stats'] });
    },
  });
}

export function useUpdateActivity() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) =>
      ipc.updateActivity(token, id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-activities'] });
      qc.invalidateQueries({ queryKey: ['crm-stats'] });
    },
  });
}

export function useDeleteActivity() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc.deleteActivity(token, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-activities'] });
      qc.invalidateQueries({ queryKey: ['crm-stats'] });
    },
  });
}

export function useCompleteActivity() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc.completeActivity(token, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-activities'] });
      qc.invalidateQueries({ queryKey: ['crm-stats'] });
    },
  });
}
