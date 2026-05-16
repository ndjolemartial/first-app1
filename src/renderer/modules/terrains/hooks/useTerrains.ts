import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.terrains;
const token = () => useAuthStore.getState().token!;

export function useTerrains(filters: object = {}, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['terrains', filters, page],
    queryFn: () => ipc().list(token(), filters, page, limit),
  });
}

export function useTerrain(id: number) {
  return useQuery({
    queryKey: ['terrain', id],
    queryFn: () => ipc().getById(token(), id),
    enabled: id > 0,
  });
}

export function useCreateTerrain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().create(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['terrains'] }); toast.success('Terrain créé'); }
      else toast.error(String(res.error));
    },
  });
}

export function useUpdateTerrain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().update(token(), id, payload),
    onSuccess: (res, { id }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['terrains'] });
        qc.invalidateQueries({ queryKey: ['terrain', id] });
        toast.success('Terrain mis à jour');
      } else toast.error(String(res.error));
    },
  });
}

export function useUpdateTerrainStatut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, statut }: { id: number; statut: string }) => ipc().updateStatut(token(), id, statut),
    onSuccess: (res, { id }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['terrains'] });
        qc.invalidateQueries({ queryKey: ['terrain', id] });
      }
    },
  });
}

export function useDeleteTerrain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['terrains'] }); toast.success('Terrain supprimé'); }
      else toast.error(String(res.error));
    },
  });
}
