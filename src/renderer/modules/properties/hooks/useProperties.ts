import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.properties;
const token = () => useAuthStore.getState().token!;

export function useProperties(filters: object = {}, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['properties', filters, page],
    queryFn: () => ipc().list(token(), filters, page, limit),
  });
}

export function useProperty(id: number) {
  return useQuery({
    queryKey: ['property', id],
    queryFn: () => ipc().getById(token(), id),
    enabled: id > 0,
  });
}

export function useCreateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().create(token(), payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  });
}

export function useUpdateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) =>
      ipc().update(token(), id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['properties'] });
      qc.invalidateQueries({ queryKey: ['property', id] });
    },
  });
}

export function useDeleteProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().delete(token(), id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  });
}

export function usePropertiesStatusStats(filters: object = {}) {
  // Clé préfixée par 'properties' afin que les invalidations existantes
  // (create/update/delete/updateStatus) rafraîchissent aussi les stats.
  return useQuery({
    queryKey: ['properties', 'status-stats', filters],
    queryFn: () => ipc().statusStats(token(), filters),
  });
}

export function useUpdatePropertyStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      ipc().updateStatus(token(), id, status),
    onSuccess: (res, { id }) => {
      if (res?.success) {
        qc.invalidateQueries({ queryKey: ['properties'] });
        qc.invalidateQueries({ queryKey: ['property', id] });
      } else {
        toast.error(String(res?.error ?? 'Échec de la mise à jour du statut'));
      }
    },
  });
}
