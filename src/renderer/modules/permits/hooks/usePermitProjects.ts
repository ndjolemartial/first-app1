import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.permits;
const token = () => useAuthStore.getState().token!;

export function usePermitProjects(filters: object = {}, page = 1, limit = 50) {
  return useQuery({
    queryKey: ['permit-projects', filters, page],
    queryFn: () => ipc().projects.list(token(), filters, page, limit),
  });
}

export function usePermitProject(id: number) {
  return useQuery({
    queryKey: ['permit-project', id],
    queryFn: () => ipc().projects.getById(token(), id),
    enabled: id > 0,
  });
}

export function useCreatePermitProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().projects.create(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['permit-projects'] }); toast.success('Projet créé'); }
      else toast.error(String(res.error));
    },
  });
}

export function useUpdatePermitProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().projects.update(token(), id, payload),
    onSuccess: (res, { id }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['permit-projects'] });
        qc.invalidateQueries({ queryKey: ['permit-project', id] });
        toast.success('Projet mis à jour');
      } else toast.error(String(res.error));
    },
  });
}

export function useDeletePermitProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().projects.delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['permit-projects'] }); toast.success('Projet supprimé'); }
      else toast.error(String(res.error));
    },
  });
}

/** Estimation rapide, non persistée — recalculée en direct pendant la saisie du formulaire. */
export function usePermitQuickEstimate(args: { projectId?: number; characteristics?: object }, enabled: boolean) {
  return useQuery({
    queryKey: ['permit-quick-estimate', args],
    queryFn: () => ipc().quickEstimate(token(), args),
    enabled,
  });
}

export function useGeneratePermitEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: number) => ipc().generateEstimate(token(), projectId),
    onSuccess: (res, projectId) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['permit-projects'] });
        qc.invalidateQueries({ queryKey: ['permit-project', projectId] });
        qc.invalidateQueries({ queryKey: ['permit-estimates', projectId] });
        toast.success('Estimation générée');
      } else toast.error(String(res.error));
    },
  });
}

export function usePermitEstimates(projectId: number) {
  return useQuery({
    queryKey: ['permit-estimates', projectId],
    queryFn: () => ipc().estimates.list(token(), projectId),
    enabled: projectId > 0,
  });
}

export function usePermitEstimate(id: number) {
  return useQuery({
    queryKey: ['permit-estimate', id],
    queryFn: () => ipc().estimates.getById(token(), id),
    enabled: id > 0,
  });
}

export function usePermitEstimateToQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ estimateId, payload }: { estimateId: number; payload: object }) => ipc().estimates.toQuote(token(), estimateId, payload),
    onSuccess: (res, { estimateId }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['permit-estimate', estimateId] });
        qc.invalidateQueries({ queryKey: ['permit-estimates'] });
        toast.success('Devis créé à partir de l’estimation');
      } else toast.error(String(res.error));
    },
  });
}

export function useSetPermitEstimateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => ipc().estimates.setStatus(token(), id, status),
    onSuccess: (res, { id }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['permit-estimate', id] });
        qc.invalidateQueries({ queryKey: ['permit-estimates'] });
        toast.success('Statut mis à jour');
      } else toast.error(String(res.error));
    },
  });
}

export function useDeletePermitEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().estimates.delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['permit-estimates'] }); toast.success('Estimation supprimée'); }
      else toast.error(String(res.error));
    },
  });
}
