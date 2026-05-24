import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.projects;
const token = () => useAuthStore.getState().token!;

// ── PROJETS ────────────────────────────────────────────────────

export function useProjects(filters: object = {}, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['projects', filters, page],
    queryFn: () => ipc().list(token(), filters, page, limit),
  });
}

export function useProject(id: number) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: () => ipc().getById(token(), id),
    enabled: id > 0,
  });
}

export function useProjectsStatusStats(filters: object = {}) {
  return useQuery({
    queryKey: ['projects', 'status-stats', filters],
    queryFn: () => ipc().statusStats(token(), filters),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().create(token(), payload),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['projects'] });
        toast.success('Projet créé');
      } else {
        toast.error(typeof res.error === 'string' ? res.error : 'Erreur lors de la création');
      }
    },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) =>
      ipc().update(token(), id, payload),
    onSuccess: (res, { id }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['projects'] });
        qc.invalidateQueries({ queryKey: ['project', id] });
        toast.success('Projet mis à jour');
      } else {
        toast.error(typeof res.error === 'string' ? res.error : 'Erreur lors de la mise à jour');
      }
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().delete(token(), id),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['projects'] });
        toast.success('Projet supprimé');
      } else {
        toast.error(typeof res.error === 'string' ? res.error : 'Erreur lors de la suppression');
      }
    },
  });
}

// ── TYPES DE PROJETS ───────────────────────────────────────────

export function useProjectTypes(includeInactive = false) {
  return useQuery({
    queryKey: ['projectTypes', includeInactive],
    queryFn: () => ipc().listTypes(token(), includeInactive),
  });
}

export function useCreateProjectType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().createType(token(), payload),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['projectTypes'] });
        toast.success('Type de projet créé');
      } else {
        toast.error(typeof res.error === 'string' ? res.error : 'Erreur lors de la création');
      }
    },
  });
}

export function useUpdateProjectType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) =>
      ipc().updateType(token(), id, payload),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['projectTypes'] });
        toast.success('Type de projet mis à jour');
      } else {
        toast.error(typeof res.error === 'string' ? res.error : 'Erreur lors de la mise à jour');
      }
    },
  });
}

export function useDeleteProjectType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().deleteType(token(), id),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['projectTypes'] });
        toast.success('Type de projet supprimé');
      } else {
        toast.error(typeof res.error === 'string' ? res.error : 'Erreur lors de la suppression');
      }
    },
  });
}
