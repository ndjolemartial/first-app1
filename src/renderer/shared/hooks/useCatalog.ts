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

/* ─── Unités de mesure (référentiel partagé `KpiUnit`) ──────────── */

export function useCatalogUnits(includeInactive = false) {
  return useQuery({
    queryKey: ['catalog-units', includeInactive],
    queryFn: () => ipc().listUnits(token(), includeInactive),
  });
}

export function useSaveCatalogUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: object }) =>
      id ? ipc().updateUnit(token(), id, payload) : ipc().createUnit(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['catalog-units'] }); toast.success('Unité enregistrée'); }
      else toast.error(String(res.error));
    },
  });
}

export function useDeleteCatalogUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().deleteUnit(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['catalog-units'] }); toast.success('Unité supprimée'); }
      else toast.error(String(res.error));
    },
  });
}

/* ─── Catégories (référentiel `CatalogCategory`) ─────────────────── */

export function useCatalogCategories(includeInactive = false) {
  return useQuery({
    queryKey: ['catalog-categories', includeInactive],
    queryFn: () => ipc().listCategories(token(), includeInactive),
  });
}

export function useSaveCatalogCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: object }) =>
      id ? ipc().updateCategory(token(), id, payload) : ipc().createCategory(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['catalog-categories'] }); toast.success('Catégorie enregistrée'); }
      else toast.error(String(res.error));
    },
  });
}

export function useDeleteCatalogCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().deleteCategory(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['catalog-categories'] }); toast.success('Catégorie supprimée'); }
      else toast.error(String(res.error));
    },
  });
}
