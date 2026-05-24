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
        toast.success('Statut du terrain mis à jour');
      } else {
        toast.error(String(res.error));
      }
    },
  });
}

export function useTerrainsStatusStats(filters: object = {}) {
  // Clé préfixée par 'terrains' afin que les invalidations existantes
  // (create/update/delete/updateStatut) rafraîchissent aussi les stats.
  return useQuery({
    queryKey: ['terrains', 'status-stats', filters],
    queryFn: () => ipc().statusStats(token(), filters),
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

export function useGenerateAcdInvoices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().generateAcdInvoices(token(), id),
    onSuccess: (res, id) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['terrain', id] });
        qc.invalidateQueries({ queryKey: ['invoices'] });
        toast.success(`${res.data?.count ?? 0} facture(s) générée(s)`);
      } else toast.error(String(res.error));
    },
  });
}

export function useCancelAcdInvoices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().cancelAcdInvoices(token(), id),
    onSuccess: (res, id) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['terrain', id] });
        qc.invalidateQueries({ queryKey: ['invoices'] });
        toast.success(`${res.data?.cancelled ?? 0} facture(s) annulée(s)`);
      } else toast.error(String(res.error));
    },
  });
}

export function useUpdateAcdInvoices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ terrainId, invoices }: { terrainId: number; invoices: { id: number; dueDate: string; amount: number }[] }) =>
      ipc().updateAcdInvoices(token(), terrainId, invoices),
    onSuccess: (res, { terrainId }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['terrain', terrainId] });
        qc.invalidateQueries({ queryKey: ['invoices'] });
      }
    },
  });
}
