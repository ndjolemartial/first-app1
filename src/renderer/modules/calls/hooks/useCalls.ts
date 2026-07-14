import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.calls;
const token = () => useAuthStore.getState().token!;

export function useCalls(filters: object = {}, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['calls', filters, page],
    queryFn: () => ipc().list(token(), filters, page, limit),
  });
}

export function useCall(id: number) {
  return useQuery({
    queryKey: ['call', id],
    queryFn: () => ipc().getById(token(), id),
    enabled: id > 0,
  });
}

export function useCallsStats() {
  return useQuery({
    queryKey: ['calls', 'stats'],
    queryFn: () => ipc().stats(token()),
  });
}

export function useCreateCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().create(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['calls'] }); toast.success('Appel enregistré'); }
      else toast.error(String(res.error));
    },
  });
}

export function useUpdateCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().update(token(), id, payload),
    onSuccess: (res, { id }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['calls'] });
        qc.invalidateQueries({ queryKey: ['call', id] });
        toast.success('Appel mis à jour');
      } else toast.error(String(res.error));
    },
  });
}

export function useDeleteCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['calls'] }); toast.success('Appel supprimé'); }
      else toast.error(String(res.error));
    },
  });
}

/* ─── Lignes téléphoniques (référentiel du champ « Ligne téléphonique ») ─── */

export function usePhoneLines(includeInactive = false) {
  return useQuery({
    queryKey: ['phone-lines', includeInactive],
    queryFn: () => ipc().phoneLines.list(token(), includeInactive),
  });
}

export function useSavePhoneLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: object }) =>
      id ? ipc().phoneLines.update(token(), id, payload) : ipc().phoneLines.create(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['phone-lines'] }); toast.success('Ligne téléphonique enregistrée'); }
      else toast.error(String(res.error));
    },
  });
}

export function useDeletePhoneLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().phoneLines.delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['phone-lines'] }); toast.success('Ligne téléphonique supprimée'); }
      else toast.error(String(res.error));
    },
  });
}
