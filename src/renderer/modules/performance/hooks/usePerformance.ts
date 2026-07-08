import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.performance;
const token = () => useAuthStore.getState().token!;

function onErr(res: { success: boolean; error?: unknown }): boolean {
  if (!res.success) { toast.error(String(res.error)); return false; }
  return true;
}

/* ─── Catalogue KPI ─────────────────────────────────────────────── */

export function useKpis(includeInactive = false) {
  return useQuery({ queryKey: ['perf-kpis', includeInactive], queryFn: () => ipc().kpis.list(token(), includeInactive) });
}

export function useSaveKpi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: object }) =>
      id ? ipc().kpis.update(token(), id, payload) : ipc().kpis.create(token(), payload),
    onSuccess: (res) => { if (onErr(res)) { qc.invalidateQueries({ queryKey: ['perf-kpis'] }); toast.success('KPI enregistré'); } },
  });
}

export function useDeleteKpi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().kpis.delete(token(), id),
    onSuccess: (res) => { if (onErr(res)) { qc.invalidateQueries({ queryKey: ['perf-kpis'] }); toast.success('KPI supprimé'); } },
  });
}

/* ─── Profils de pondération ────────────────────────────────────── */

export function useWeightProfiles() {
  return useQuery({ queryKey: ['perf-weights'], queryFn: () => ipc().weights.list(token()) });
}

export function useSaveWeightProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number | null; payload: object }) => ipc().weights.upsert(token(), id, payload),
    onSuccess: (res) => { if (onErr(res)) { qc.invalidateQueries({ queryKey: ['perf-weights'] }); toast.success('Profil enregistré'); } },
  });
}

export function useDeleteWeightProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().weights.delete(token(), id),
    onSuccess: (res) => { if (onErr(res)) { qc.invalidateQueries({ queryKey: ['perf-weights'] }); toast.success('Profil supprimé'); } },
  });
}

/* ─── Unités des KPI ────────────────────────────────────────────── */

export function useKpiUnits(includeInactive = false) {
  return useQuery({ queryKey: ['perf-units', includeInactive], queryFn: () => ipc().units.list(token(), includeInactive) });
}

export function useSaveKpiUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: object }) =>
      id ? ipc().units.update(token(), id, payload) : ipc().units.create(token(), payload),
    onSuccess: (res) => { if (onErr(res)) { qc.invalidateQueries({ queryKey: ['perf-units'] }); toast.success('Unité enregistrée'); } },
  });
}

export function useDeleteKpiUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().units.delete(token(), id),
    onSuccess: (res) => { if (onErr(res)) { qc.invalidateQueries({ queryKey: ['perf-units'] }); toast.success('Unité supprimée'); } },
  });
}

/* ─── Employés (périmètre performance) ──────────────────────────── */

export function usePerfEmployees() {
  return useQuery({ queryKey: ['perf-employees'], queryFn: () => ipc().employees.list(token()) });
}

/* ─── Objectifs ─────────────────────────────────────────────────── */

export function useObjectives(filters: object = {}) {
  return useQuery({ queryKey: ['perf-objectives', filters], queryFn: () => ipc().objectives.list(token(), filters) });
}

export function useSaveObjective() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: object }) =>
      id ? ipc().objectives.update(token(), id, payload) : ipc().objectives.create(token(), payload),
    onSuccess: (res) => { if (onErr(res)) { qc.invalidateQueries({ queryKey: ['perf-objectives'] }); toast.success('Objectif enregistré'); } },
  });
}

export function useDeleteObjective() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().objectives.delete(token(), id),
    onSuccess: (res) => { if (onErr(res)) { qc.invalidateQueries({ queryKey: ['perf-objectives'] }); toast.success('Objectif supprimé'); } },
  });
}

export function useDuplicateObjectives() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ source, target }: { source: object; target: object }) => ipc().objectives.duplicate(token(), source, target),
    onSuccess: (res) => {
      if (onErr(res)) {
        qc.invalidateQueries({ queryKey: ['perf-objectives'] });
        const d = (res as any).data ?? {};
        toast.success(`${d.created ?? 0} objectif(s) dupliqué(s)${d.skipped ? ` · ${d.skipped} ignoré(s)` : ''}`);
      }
    },
  });
}

/* ─── Évaluations ───────────────────────────────────────────────── */

export function useEvaluations(filters: object = {}) {
  return useQuery({ queryKey: ['perf-evaluations', filters], queryFn: () => ipc().evaluations.list(token(), filters) });
}

export function useEvaluation(id: number) {
  return useQuery({ queryKey: ['perf-evaluation', id], queryFn: () => ipc().evaluations.getById(token(), id), enabled: id > 0 });
}

export function useCreateEvaluation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().evaluations.create(token(), payload),
    onSuccess: (res) => { if (onErr(res)) { qc.invalidateQueries({ queryKey: ['perf-evaluations'] }); toast.success('Évaluation créée'); } },
  });
}

export function useUpdateEvaluation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().evaluations.update(token(), id, payload),
    onSuccess: (res, { id }) => { if (onErr(res)) { qc.invalidateQueries({ queryKey: ['perf-evaluation', id] }); qc.invalidateQueries({ queryKey: ['perf-evaluations'] }); toast.success('Évaluation mise à jour'); } },
  });
}

export function useEvaluationAction() {
  const qc = useQueryClient();
  const invalidate = (id: number) => { qc.invalidateQueries({ queryKey: ['perf-evaluation', id] }); qc.invalidateQueries({ queryKey: ['perf-evaluations'] }); };
  return {
    computeKpis: useMutation({
      mutationFn: (id: number) => ipc().evaluations.computeKpis(token(), id),
      onSuccess: (res, id) => { if (onErr(res)) { invalidate(id); toast.success('KPI calculés'); } },
    }),
    submit: useMutation({
      mutationFn: (id: number) => ipc().evaluations.submit(token(), id),
      onSuccess: (res, id) => { if (onErr(res)) { invalidate(id); toast.success('Évaluation soumise'); } },
    }),
    sign: useMutation({
      mutationFn: ({ id, level }: { id: number; level: 'MANAGER' | 'EMPLOYEE' | 'DIRECTION' }) => ipc().evaluations.sign(token(), id, level),
      onSuccess: (res, { id }) => { if (onErr(res)) { invalidate(id); toast.success('Signature enregistrée'); } },
    }),
    refuse: useMutation({
      mutationFn: ({ id, reason }: { id: number; reason?: string }) => ipc().evaluations.refuse(token(), id, reason),
      onSuccess: (res, { id }) => { if (onErr(res)) { invalidate(id); toast.success('Évaluation refusée'); } },
    }),
    remove: useMutation({
      mutationFn: (id: number) => ipc().evaluations.delete(token(), id),
      onSuccess: (res) => { if (onErr(res)) { qc.invalidateQueries({ queryKey: ['perf-evaluations'] }); toast.success('Évaluation supprimée'); } },
    }),
  };
}

/* ─── Plans de progrès ──────────────────────────────────────────── */

export function usePlans(filters: object = {}) {
  return useQuery({ queryKey: ['perf-plans', filters], queryFn: () => ipc().plans.list(token(), filters) });
}

export function useSavePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: object }) =>
      id ? ipc().plans.update(token(), id, payload) : ipc().plans.create(token(), payload),
    onSuccess: (res) => { if (onErr(res)) { qc.invalidateQueries({ queryKey: ['perf-plans'] }); qc.invalidateQueries({ queryKey: ['perf-evaluation'] }); toast.success('Plan de progrès enregistré'); } },
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().plans.delete(token(), id),
    onSuccess: (res) => { if (onErr(res)) { qc.invalidateQueries({ queryKey: ['perf-plans'] }); qc.invalidateQueries({ queryKey: ['perf-evaluation'] }); toast.success('Plan supprimé'); } },
  });
}

/* ─── Classements & tableau de bord ─────────────────────────────── */

export function useRanking(periodType: string, refDate?: string, basis?: string) {
  return useQuery({ queryKey: ['perf-ranking', periodType, refDate, basis], queryFn: () => ipc().rankings.get(token(), periodType, refDate, basis) });
}

export function useRankingHistory(periodType?: string) {
  return useQuery({ queryKey: ['perf-ranking-history', periodType], queryFn: () => ipc().rankings.history(token(), periodType) });
}

export function useSnapshotRanking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ periodType, refDate, basis }: { periodType: string; refDate?: string; basis?: string }) =>
      ipc().rankings.snapshot(token(), periodType, refDate, basis),
    onSuccess: (res) => { if (onErr(res)) { qc.invalidateQueries({ queryKey: ['perf-ranking-history'] }); toast.success('Classement archivé'); } },
  });
}

export function useRankingSnapshot(id?: number) {
  return useQuery({
    queryKey: ['perf-ranking-snapshot', id],
    enabled: !!id,
    queryFn: () => ipc().rankings.getSnapshot(token(), id!),
  });
}

export function useDeleteRankingSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().rankings.deleteSnapshot(token(), id),
    onSuccess: (res) => {
      if (onErr(res)) {
        qc.invalidateQueries({ queryKey: ['perf-ranking-history'] });
        toast.success('Classement archivé supprimé');
      }
    },
  });
}

export function usePerfDashboard() {
  return useQuery({ queryKey: ['perf-dashboard'], queryFn: () => ipc().dashboard(token()) });
}

export function useRankingRoster() {
  return useQuery({ queryKey: ['perf-roster'], queryFn: () => ipc().rankings.getRoster(token()) });
}

export function useSaveRankingRoster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => ipc().rankings.setRoster(token(), ids),
    onSuccess: (res) => {
      if (onErr(res)) {
        qc.invalidateQueries({ queryKey: ['perf-roster'] });
        qc.invalidateQueries({ queryKey: ['perf-ranking'] });
        qc.invalidateQueries({ queryKey: ['perf-dashboard'] });
        toast.success('Personnel à classer enregistré');
      }
    },
  });
}

/* ─── Self-service ──────────────────────────────────────────────── */

export function useMyPerformance(year?: number) {
  return useQuery({ queryKey: ['perf-me', year], queryFn: () => ipc().me.overview(token(), year) });
}

export function useMyRanking(periodType: string) {
  return useQuery({ queryKey: ['perf-me-ranking', periodType], queryFn: () => ipc().me.ranking(token(), periodType) });
}

/** Objectifs à Mesure « Manuelle » assignés au collaborateur connecté (pour lier une tâche). */
export function useMyManualObjectives(enabled = true) {
  return useQuery({ queryKey: ['perf-me-manual-objectives'], queryFn: () => ipc().me.manualObjectives(token()), enabled });
}

export function useMySignEvaluation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().me.sign(token(), id),
    onSuccess: (res) => { if (onErr(res)) { qc.invalidateQueries({ queryKey: ['perf-me'] }); toast.success('Évaluation signée'); } },
  });
}
