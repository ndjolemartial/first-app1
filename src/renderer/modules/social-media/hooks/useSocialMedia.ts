import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.socialMedia;
const token = () => useAuthStore.getState().token!;

// ── Plateformes ────────────────────────────────────────────────────────────
export function usePlatforms(includeInactive = true) {
  return useQuery({
    queryKey: ['social-platforms', includeInactive],
    queryFn: () => ipc().platforms.list(token(), includeInactive),
  });
}

export function useCreatePlatform() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().platforms.create(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['social-platforms'] }); toast.success('Plateforme créée'); }
      else toast.error(String(res.error));
    },
  });
}

export function useUpdatePlatform() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().platforms.update(token(), id, payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['social-platforms'] }); toast.success('Plateforme mise à jour'); }
      else toast.error(String(res.error));
    },
  });
}

export function useDeletePlatform() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().platforms.delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['social-platforms'] }); toast.success('Plateforme archivée'); }
      else toast.error(String(res.error));
    },
  });
}

// ── Publications / articles ─────────────────────────────────────────────────
export function usePublications(filters: object = {}, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['social-publications', filters, page],
    queryFn: () => ipc().publications.list(token(), filters, page, limit),
  });
}

export function useCreatePublication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().publications.create(token(), payload),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['social-publications'] });
        qc.invalidateQueries({ queryKey: ['social-dashboard'] });
        toast.success('Publication enregistrée');
      } else toast.error(String(res.error));
    },
  });
}

export function useUpdatePublication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().publications.update(token(), id, payload),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['social-publications'] });
        qc.invalidateQueries({ queryKey: ['social-dashboard'] });
        toast.success('Publication mise à jour');
      } else toast.error(String(res.error));
    },
  });
}

export function useDeletePublication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().publications.delete(token(), id),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['social-publications'] });
        qc.invalidateQueries({ queryKey: ['social-dashboard'] });
        toast.success('Publication supprimée');
      } else toast.error(String(res.error));
    },
  });
}

// ── Relevés d'abonnés ────────────────────────────────────────────────────────
export function useFollowerSnapshots(platformId?: number, limit = 50) {
  return useQuery({
    queryKey: ['social-followers', platformId, limit],
    queryFn: () => ipc().snapshots.list(token(), platformId, limit),
  });
}

export function useUpsertSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().snapshots.upsert(token(), payload),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['social-followers'] });
        qc.invalidateQueries({ queryKey: ['social-dashboard'] });
        toast.success('Relevé d’abonnés enregistré');
      } else toast.error(String(res.error));
    },
  });
}

export function useDeleteSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().snapshots.delete(token(), id),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['social-followers'] });
        qc.invalidateQueries({ queryKey: ['social-dashboard'] });
        toast.success('Relevé supprimé');
      } else toast.error(String(res.error));
    },
  });
}

// ── Tableau de bord ──────────────────────────────────────────────────────────
export function useSocialDashboard() {
  return useQuery({
    queryKey: ['social-dashboard'],
    queryFn: () => ipc().dashboard(token()),
  });
}
