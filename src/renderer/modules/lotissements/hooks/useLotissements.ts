import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.lotissements;
const token = () => useAuthStore.getState().token!;

export function useLotissements(filters: object = {}, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['lotissements', filters, page],
    queryFn: () => ipc().list(token(), filters, page, limit),
  });
}

export function useLotissement(id: number) {
  return useQuery({
    queryKey: ['lotissement', id],
    queryFn: () => ipc().getById(token(), id),
    enabled: id > 0,
  });
}

export function useCreateLotissement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().create(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['lotissements'] }); toast.success('Lotissement créé'); }
      else toast.error(String(res.error));
    },
  });
}

export function useUpdateLotissement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().update(token(), id, payload),
    onSuccess: (res, { id }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['lotissements'] });
        qc.invalidateQueries({ queryKey: ['lotissement', id] });
        toast.success('Lotissement mis à jour');
      } else toast.error(String(res.error));
    },
  });
}

export function useDeleteLotissement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['lotissements'] }); toast.success('Lotissement supprimé'); }
      else toast.error(String(res.error));
    },
  });
}
