import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.construction;
const token = () => useAuthStore.getState().token!;

export function useConstructionProjects(filters: object = {}, page = 1, limit = 50) {
  return useQuery({
    queryKey: ['construction-projects', filters, page],
    queryFn: () => ipc().projects.list(token(), filters, page, limit),
  });
}

export function useConstructionProject(id: number) {
  return useQuery({
    queryKey: ['construction-project', id],
    queryFn: () => ipc().projects.getById(token(), id),
    enabled: id > 0,
  });
}

export function useCreateConstructionProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().projects.create(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['construction-projects'] }); toast.success('Projet créé'); }
      else toast.error(String(res.error));
    },
  });
}

export function useUpdateConstructionProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().projects.update(token(), id, payload),
    onSuccess: (res, { id }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['construction-projects'] });
        qc.invalidateQueries({ queryKey: ['construction-project', id] });
        toast.success('Projet mis à jour');
      } else toast.error(String(res.error));
    },
  });
}

export function useDuplicateConstructionProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().projects.duplicate(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['construction-projects'] }); toast.success('Projet dupliqué'); }
      else toast.error(String(res.error));
    },
  });
}

export function useDeleteConstructionProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().projects.delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['construction-projects'] }); toast.success('Projet supprimé'); }
      else toast.error(String(res.error));
    },
  });
}

/** Niveau 1 — estimation rapide, non persistée. */
export function useQuickEstimate(args: { projectId?: number; characteristics?: object }, enabled: boolean) {
  return useQuery({
    queryKey: ['construction-quick-estimate', args],
    queryFn: () => ipc().quickEstimate(token(), args),
    enabled,
  });
}

export function useGenerateEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().generateEstimate(token(), payload),
    onSuccess: (res, payload: any) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['construction-projects'] });
        qc.invalidateQueries({ queryKey: ['construction-project', payload.projectId] });
        qc.invalidateQueries({ queryKey: ['construction-estimates', payload.projectId] });
        toast.success('Estimation générée');
      } else toast.error(String(res.error));
    },
  });
}
