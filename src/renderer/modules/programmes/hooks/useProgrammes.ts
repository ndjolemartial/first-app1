import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.programmes;
const token = () => useAuthStore.getState().token!;

export function useProgrammes(filters: object = {}, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['programmes', filters, page],
    queryFn: () => ipc().list(token(), filters, page, limit),
  });
}

export function useProgramme(id: number) {
  return useQuery({
    queryKey: ['programme', id],
    queryFn: () => ipc().getById(token(), id),
    enabled: id > 0,
  });
}

export function useCreateProgramme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().create(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['programmes'] }); toast.success('Programme immobilier créé'); }
      else toast.error(String(res.error));
    },
  });
}

export function useUpdateProgramme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().update(token(), id, payload),
    onSuccess: (res, { id }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['programmes'] });
        qc.invalidateQueries({ queryKey: ['programme', id] });
        toast.success('Programme immobilier mis à jour');
      } else toast.error(String(res.error));
    },
  });
}

export function useDeleteProgramme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['programmes'] }); toast.success('Programme immobilier supprimé'); }
      else toast.error(String(res.error));
    },
  });
}
