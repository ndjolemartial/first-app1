import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.construction;
const token = () => useAuthStore.getState().token!;

export function useConstructionEstimates(projectId: number) {
  return useQuery({
    queryKey: ['construction-estimates', projectId],
    queryFn: () => ipc().estimates.list(token(), projectId),
    enabled: projectId > 0,
  });
}

export function useConstructionEstimate(id: number) {
  return useQuery({
    queryKey: ['construction-estimate', id],
    queryFn: () => ipc().estimates.getById(token(), id),
    enabled: id > 0,
  });
}

export function useEstimateSummary(id: number) {
  return useQuery({
    queryKey: ['construction-estimate-summary', id],
    queryFn: () => ipc().estimates.summary(token(), id),
    enabled: id > 0,
  });
}

export function useEstimateMaterials(id: number) {
  return useQuery({
    queryKey: ['construction-estimate-materials', id],
    queryFn: () => ipc().estimates.materials(token(), id),
    enabled: id > 0,
  });
}

export function useEstimateLabor(id: number) {
  return useQuery({
    queryKey: ['construction-estimate-labor', id],
    queryFn: () => ipc().estimates.labor(token(), id),
    enabled: id > 0,
  });
}

export function useEstimateToQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ estimateId, payload }: { estimateId: number; payload: object }) => ipc().estimates.toQuote(token(), estimateId, payload),
    onSuccess: (res, { estimateId }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['construction-estimate', estimateId] });
        qc.invalidateQueries({ queryKey: ['construction-estimates'] });
        toast.success('Devis créé à partir de l’estimation');
      } else toast.error(String(res.error));
    },
  });
}

export function useSetEstimateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => ipc().estimates.setStatus(token(), id, status),
    onSuccess: (res, { id }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['construction-estimate', id] });
        qc.invalidateQueries({ queryKey: ['construction-estimates'] });
        toast.success('Statut mis à jour');
      } else toast.error(String(res.error));
    },
  });
}

export function useDeleteEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().estimates.delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['construction-estimates'] }); toast.success('Estimation supprimée'); }
      else toast.error(String(res.error));
    },
  });
}
