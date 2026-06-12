import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/auth.store';
import { toast } from '../components/ui/Toast';

const ipc = () => window.electron.catalog;
const token = () => useAuthStore.getState().token!;

/** Catalogue de prestations / produits. `includeInactive` pour la gestion. */
export function useCatalog(filters: { type?: string; search?: string; includeInactive?: boolean } = {}) {
  return useQuery({
    queryKey: ['catalog', filters],
    queryFn: () => ipc().list(token(), filters),
  });
}

export function useCreateCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().create(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['catalog'] }); toast.success('Article ajouté'); }
      else toast.error(String(res.error));
    },
  });
}

export function useUpdateCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().update(token(), id, payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['catalog'] }); toast.success('Article mis à jour'); }
      else toast.error(String(res.error));
    },
  });
}

export function useDeleteCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['catalog'] }); toast.success('Article supprimé'); }
      else toast.error(String(res.error));
    },
  });
}
