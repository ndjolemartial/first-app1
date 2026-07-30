import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.constructionLibrary;
const token = () => useAuthStore.getState().token!;

function useInvalidate(keys: string[]) {
  const qc = useQueryClient();
  return () => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

/* ─── Lots ────────────────────────────────────────────────────────────── */
export function useConstructionLots(includeInactive = false) {
  return useQuery({ queryKey: ['construction-lots', includeInactive], queryFn: () => ipc().lots.list(token(), includeInactive) });
}
export function useSaveConstructionLot() {
  const invalidate = useInvalidate(['construction-lots']);
  return useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: object }) => ipc().lots.upsert(token(), id, payload),
    onSuccess: (res) => { if (res.success) { invalidate(); toast.success('Lot enregistré'); } else toast.error(String(res.error)); },
  });
}
export function useDeleteConstructionLot() {
  const invalidate = useInvalidate(['construction-lots']);
  return useMutation({
    mutationFn: (id: number) => ipc().lots.delete(token(), id),
    onSuccess: (res) => { if (res.success) { invalidate(); toast.success('Lot supprimé'); } else toast.error(String(res.error)); },
  });
}

/* ─── Familles de ressources ─────────────────────────────────────────── */
export function useResourceFamilies(includeInactive = false) {
  return useQuery({ queryKey: ['construction-resource-families', includeInactive], queryFn: () => ipc().resourceFamilies.list(token(), includeInactive) });
}
export function useCreateResourceFamily() {
  const invalidate = useInvalidate(['construction-resource-families']);
  return useMutation({
    mutationFn: (payload: object) => ipc().resourceFamilies.create(token(), payload),
    onSuccess: (res) => { if (res.success) invalidate(); else toast.error(String(res.error)); },
  });
}
export function useDeleteResourceFamily() {
  const invalidate = useInvalidate(['construction-resource-families']);
  return useMutation({
    mutationFn: (id: number) => ipc().resourceFamilies.delete(token(), id),
    onSuccess: (res) => { if (res.success) invalidate(); else toast.error(String(res.error)); },
  });
}

/* ─── Localités ───────────────────────────────────────────────────────── */
export function useConstructionLocalities(includeInactive = false) {
  return useQuery({ queryKey: ['construction-localities', includeInactive], queryFn: () => ipc().localities.list(token(), includeInactive) });
}
export function useSaveConstructionLocality() {
  const invalidate = useInvalidate(['construction-localities']);
  return useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: object }) => ipc().localities.upsert(token(), id, payload),
    onSuccess: (res) => { if (res.success) { invalidate(); toast.success('Localité enregistrée'); } else toast.error(String(res.error)); },
  });
}
export function useDeleteConstructionLocality() {
  const invalidate = useInvalidate(['construction-localities']);
  return useMutation({
    mutationFn: (id: number) => ipc().localities.delete(token(), id),
    onSuccess: (res) => { if (res.success) { invalidate(); toast.success('Localité supprimée'); } else toast.error(String(res.error)); },
  });
}

/* ─── Ressources (bordereau de prix) ─────────────────────────────────── */
export function useConstructionResources(filters: object = {}, page = 1, limit = 200) {
  return useQuery({ queryKey: ['construction-resources', filters, page], queryFn: () => ipc().resources.list(token(), filters, page, limit) });
}
export function useConstructionResource(id: number) {
  return useQuery({ queryKey: ['construction-resource', id], queryFn: () => ipc().resources.getById(token(), id), enabled: id > 0 });
}
export function useSaveConstructionResource() {
  const invalidate = useInvalidate(['construction-resources']);
  return useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: object }) =>
      (id ? ipc().resources.update(token(), id, payload) : ipc().resources.create(token(), payload)),
    onSuccess: (res) => { if (res.success) { invalidate(); toast.success('Ressource enregistrée'); } else toast.error(String(res.error)); },
  });
}
export function useUpdateResourcePrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().resources.updatePrice(token(), id, payload),
    onSuccess: (res, { id }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['construction-resources'] });
        qc.invalidateQueries({ queryKey: ['construction-resource', id] });
        toast.success('Prix mis à jour' + ((res as any).impacted ? ` — ${(res as any).impacted.workItems} ouvrage(s) concerné(s)` : ''));
      } else toast.error(String(res.error));
    },
  });
}
export function useDeleteConstructionResource() {
  const invalidate = useInvalidate(['construction-resources']);
  return useMutation({
    mutationFn: (id: number) => ipc().resources.delete(token(), id),
    onSuccess: (res) => { if (res.success) { invalidate(); toast.success('Ressource supprimée'); } else toast.error(String(res.error)); },
  });
}
export function useResourceWhereUsed(id: number) {
  return useQuery({ queryKey: ['construction-resource-where-used', id], queryFn: () => ipc().resources.whereUsed(token(), id), enabled: id > 0 });
}

/* ─── Ouvrages ────────────────────────────────────────────────────────── */
export function useConstructionWorkItems(filters: object = {}) {
  return useQuery({ queryKey: ['construction-work-items', filters], queryFn: () => ipc().workItems.list(token(), filters) });
}
export function useConstructionWorkItem(id: number) {
  return useQuery({ queryKey: ['construction-work-item', id], queryFn: () => ipc().workItems.getById(token(), id), enabled: id > 0 });
}
export function useSaveConstructionWorkItem() {
  const invalidate = useInvalidate(['construction-work-items']);
  return useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: object }) => ipc().workItems.upsert(token(), id, payload),
    onSuccess: (res) => { if (res.success) { invalidate(); toast.success('Ouvrage enregistré'); } else toast.error(String(res.error)); },
  });
}
export function useDuplicateWorkItem() {
  const invalidate = useInvalidate(['construction-work-items']);
  return useMutation({
    mutationFn: (id: number) => ipc().workItems.duplicate(token(), id),
    onSuccess: (res) => { if (res.success) { invalidate(); toast.success('Ouvrage dupliqué'); } else toast.error(String(res.error)); },
  });
}
export function useDeleteWorkItem() {
  const invalidate = useInvalidate(['construction-work-items']);
  return useMutation({
    mutationFn: (id: number) => ipc().workItems.delete(token(), id),
    onSuccess: (res) => { if (res.success) { invalidate(); toast.success('Ouvrage supprimé'); } else toast.error(String(res.error)); },
  });
}

/* ─── Catalogue des coefficients ─────────────────────────────────────── */
export function useRatioDefinitions(includeInactive = false) {
  return useQuery({ queryKey: ['construction-ratio-defs', includeInactive], queryFn: () => ipc().ratioDefs.list(token(), includeInactive) });
}
export function useSaveRatioDefinition() {
  const invalidate = useInvalidate(['construction-ratio-defs']);
  return useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: object }) =>
      (id ? ipc().ratioDefs.update(token(), id, payload) : ipc().ratioDefs.create(token(), payload)),
    onSuccess: (res) => { if (res.success) { invalidate(); toast.success('Coefficient enregistré'); } else toast.error(String(res.error)); },
  });
}
export function useDeleteRatioDefinition() {
  const invalidate = useInvalidate(['construction-ratio-defs']);
  return useMutation({
    mutationFn: (id: number) => ipc().ratioDefs.delete(token(), id),
    onSuccess: (res) => { if (res.success) { invalidate(); toast.success('Coefficient supprimé'); } else toast.error(String(res.error)); },
  });
}

/* ─── Profils de coefficients ─────────────────────────────────────────── */
export function useRatioProfiles() {
  return useQuery({ queryKey: ['construction-ratio-profiles'], queryFn: () => ipc().ratioProfiles.list(token()) });
}
export function useRatioProfile(id: number) {
  return useQuery({ queryKey: ['construction-ratio-profile', id], queryFn: () => ipc().ratioProfiles.getById(token(), id), enabled: id > 0 });
}
export function useSaveRatioProfile() {
  const invalidate = useInvalidate(['construction-ratio-profiles']);
  return useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: object }) => ipc().ratioProfiles.upsert(token(), id, payload),
    onSuccess: (res) => { if (res.success) { invalidate(); toast.success('Profil enregistré'); } else toast.error(String(res.error)); },
  });
}
export function useDuplicateRatioProfile() {
  const invalidate = useInvalidate(['construction-ratio-profiles']);
  return useMutation({
    mutationFn: ({ id, target }: { id: number; target: object }) => ipc().ratioProfiles.duplicate(token(), id, target),
    onSuccess: (res) => { if (res.success) { invalidate(); toast.success('Profil dupliqué'); } else toast.error(String(res.error)); },
  });
}
export function useDeleteRatioProfile() {
  const invalidate = useInvalidate(['construction-ratio-profiles']);
  return useMutation({
    mutationFn: (id: number) => ipc().ratioProfiles.delete(token(), id),
    onSuccess: (res) => { if (res.success) { invalidate(); toast.success('Profil supprimé'); } else toast.error(String(res.error)); },
  });
}

/* ─── Santé de la bibliothèque ────────────────────────────────────────── */
export function useLibraryHealth() {
  return useQuery({ queryKey: ['construction-library-health'], queryFn: () => ipc().health(token()) });
}
