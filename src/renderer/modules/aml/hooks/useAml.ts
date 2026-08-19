import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.aml;
const settingsIpc = () => window.electron.settings;
const token = () => useAuthStore.getState().token!;

/* ─── Profils ──────────────────────────────────────────────── */

export function useAmlProfiles(filters: object = {}, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['aml-profiles', filters, page],
    queryFn: () => ipc().profiles.list(token(), filters, page, limit),
  });
}

export function useAmlProfile(id?: number) {
  return useQuery({
    queryKey: ['aml-profile', id],
    queryFn: () => ipc().profiles.getById(token(), id!),
    enabled: !!id,
  });
}

export function useAmlProfileBySubject(subjectType?: string, subjectId?: number) {
  return useQuery({
    queryKey: ['aml-profile-badge', subjectType, subjectId],
    queryFn: () => ipc().profiles.getBySubject(token(), subjectType!, subjectId!),
    enabled: !!subjectType && !!subjectId,
  });
}

export function useAmlSubjectsWithoutProfile(subjectType: string, search?: string) {
  return useQuery({
    queryKey: ['aml-subjects-without-profile', subjectType, search],
    queryFn: () => ipc().profiles.subjectsWithoutProfile(token(), subjectType, search),
  });
}

export function useCreateAmlProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().profiles.create(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['aml-profiles'] }); toast.success('Profil LBC/FT créé'); }
      else toast.error(String(res.error));
    },
  });
}

export function useUpdateAmlProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().profiles.update(token(), id, payload),
    onSuccess: (res, vars) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['aml-profiles'] });
        qc.invalidateQueries({ queryKey: ['aml-profile', vars.id] });
        toast.success('Profil mis à jour');
      } else toast.error(String(res.error));
    },
  });
}

export function useSetAmlRiskFactors() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, riskFactorIds }: { id: number; riskFactorIds: number[] }) => ipc().profiles.setRiskFactors(token(), id, { riskFactorIds }),
    onSuccess: (res, vars) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['aml-profile', vars.id] }); toast.success('Facteurs de risque mis à jour'); }
      else toast.error(String(res.error));
    },
  });
}

export function useComputeAmlRisk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().profiles.computeRisk(token(), id),
    onSuccess: (res, id) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['aml-profile', id] }); toast.success('Score de risque recalculé'); }
      else toast.error(String(res.error));
    },
  });
}

function useAmlProfileTransition(action: 'validate' | 'markToReview' | 'markRefused', successMsg: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().profiles[action](token(), id),
    onSuccess: (res, id) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['aml-profiles'] });
        qc.invalidateQueries({ queryKey: ['aml-profile', id] });
        toast.success(successMsg);
      } else toast.error(String(res.error));
    },
  });
}
export const useValidateAmlProfile = () => useAmlProfileTransition('validate', 'Profil validé');
export const useMarkAmlProfileToReview = () => useAmlProfileTransition('markToReview', 'Profil marqué « à revoir »');
export const useMarkAmlProfileRefused = () => useAmlProfileTransition('markRefused', 'Profil refusé');

export function useDeleteAmlProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().profiles.delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['aml-profiles'] }); toast.success('Profil supprimé'); }
      else toast.error(String(res.error));
    },
  });
}

/* ─── Bénéficiaires effectifs ──────────────────────────────── */

export function useCreateBeneficialOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ profileId, payload }: { profileId: number; payload: object }) => ipc().beneficialOwners.create(token(), profileId, payload),
    onSuccess: (res, vars) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['aml-profile', vars.profileId] }); toast.success('Bénéficiaire effectif ajouté'); }
      else toast.error(String(res.error));
    },
  });
}

export function useUpdateBeneficialOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, profileId, payload }: { id: number; profileId: number; payload: object }) => ipc().beneficialOwners.update(token(), id, payload),
    onSuccess: (res, vars) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['aml-profile', vars.profileId] }); toast.success('Bénéficiaire effectif mis à jour'); }
      else toast.error(String(res.error));
    },
  });
}

export function useDeleteBeneficialOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, profileId }: { id: number; profileId: number }) => ipc().beneficialOwners.delete(token(), id),
    onSuccess: (res, vars) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['aml-profile', vars.profileId] }); toast.success('Bénéficiaire effectif retiré'); }
      else toast.error(String(res.error));
    },
  });
}

/* ─── Catalogue des facteurs de risque + seuils ───────────── */

export function useAmlRiskFactors(includeInactive = false) {
  return useQuery({
    queryKey: ['aml-risk-factors', includeInactive],
    queryFn: () => ipc().riskFactors.list(token(), includeInactive),
  });
}

export function useCreateAmlRiskFactor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().riskFactors.create(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['aml-risk-factors'] }); toast.success('Facteur de risque créé'); }
      else toast.error(String(res.error));
    },
  });
}

export function useUpdateAmlRiskFactor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().riskFactors.update(token(), id, payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['aml-risk-factors'] }); toast.success('Facteur de risque mis à jour'); }
      else toast.error(String(res.error));
    },
  });
}

export function useDeleteAmlRiskFactor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().riskFactors.delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['aml-risk-factors'] }); toast.success('Facteur de risque désactivé'); }
      else toast.error(String(res.error));
    },
  });
}

export function useAmlRiskThresholds() {
  return useQuery({ queryKey: ['aml-risk-thresholds'], queryFn: () => settingsIpc().getAmlRiskThresholds(token()) });
}

export function useUpdateAmlRiskThresholds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { faibleMax: number; moyenMax: number; amountThreshold: number }) => settingsIpc().updateAmlRiskThresholds(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['aml-risk-thresholds'] }); toast.success('Seuils mis à jour'); }
      else toast.error(String(res.error));
    },
  });
}

/* ─── Référentiel de vigilance ─────────────────────────────── */

export function useAmlWatchlist(filters: object = {}) {
  return useQuery({ queryKey: ['aml-watchlist', filters], queryFn: () => ipc().watchlist.list(token(), filters) });
}

export function useCreateAmlWatchlistEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().watchlist.create(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['aml-watchlist'] }); toast.success('Entrée ajoutée au référentiel'); }
      else toast.error(String(res.error));
    },
  });
}

export function useUpdateAmlWatchlistEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().watchlist.update(token(), id, payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['aml-watchlist'] }); toast.success('Entrée mise à jour'); }
      else toast.error(String(res.error));
    },
  });
}

export function useDeleteAmlWatchlistEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().watchlist.delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['aml-watchlist'] }); toast.success('Entrée retirée'); }
      else toast.error(String(res.error));
    },
  });
}

export function useScreenAmlWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (profileId: number) => ipc().watchlist.screen(token(), profileId),
    onSuccess: (res, profileId) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['aml-profile', profileId] });
        toast.success(res.matchCount ? `${res.matchCount} correspondance(s) trouvée(s) — à vérifier` : 'Aucune correspondance trouvée');
      } else toast.error(String(res.error));
    },
  });
}

export function useReviewAmlWatchlistMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, profileId, payload }: { id: number; profileId: number; payload: object }) => ipc().watchlistMatches.review(token(), id, payload),
    onSuccess: (res, vars) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['aml-profile', vars.profileId] }); toast.success('Correspondance qualifiée'); }
      else toast.error(String(res.error));
    },
  });
}

/* ─── Revues de transaction ────────────────────────────────── */

export function useAmlReviews(filters: object = {}, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['aml-reviews', filters, page],
    queryFn: () => ipc().reviews.list(token(), filters, page, limit),
  });
}

export function useAmlReview(id?: number) {
  return useQuery({
    queryKey: ['aml-review', id],
    queryFn: () => ipc().reviews.getById(token(), id!),
    enabled: !!id,
  });
}

export function useAmlReviewByConvention(conventionId?: number) {
  return useQuery({
    queryKey: ['aml-review-badge', conventionId],
    queryFn: () => ipc().reviews.getByConvention(token(), conventionId!),
    enabled: !!conventionId,
  });
}

export function useAmlPendingCandidates() {
  return useQuery({ queryKey: ['aml-pending-candidates'], queryFn: () => ipc().reviews.pendingCandidates(token()) });
}

export function useCreateAmlReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().reviews.create(token(), payload),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['aml-reviews'] });
        qc.invalidateQueries({ queryKey: ['aml-pending-candidates'] });
        toast.success('Revue de transaction créée');
      } else toast.error(String(res.error));
    },
  });
}

export function useCloseAmlReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().reviews.close(token(), id, payload),
    onSuccess: (res, vars) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['aml-reviews'] });
        qc.invalidateQueries({ queryKey: ['aml-review', vars.id] });
        toast.success('Revue clôturée');
      } else toast.error(String(res.error));
    },
  });
}

export function useDeleteAmlReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().reviews.delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['aml-reviews'] }); toast.success('Revue supprimée'); }
      else toast.error(String(res.error));
    },
  });
}

/* ─── Déclarations de soupçon ──────────────────────────────── */

export function useAmlSuspiciousReports(filters: object = {}, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['aml-suspicious-reports', filters, page],
    queryFn: () => ipc().suspiciousReports.list(token(), filters, page, limit),
  });
}

export function useAmlSuspiciousReport(id?: number) {
  return useQuery({
    queryKey: ['aml-suspicious-report', id],
    queryFn: () => ipc().suspiciousReports.getById(token(), id!),
    enabled: !!id,
  });
}

export function useCreateAmlSuspiciousReport() {
  return useMutation({
    mutationFn: (payload: object) => ipc().suspiciousReports.create(token(), payload),
    onSuccess: (res) => {
      if (res.success) toast.success(`Signalement enregistré (${res.data?.reference}) — merci de votre vigilance.`);
      else toast.error(String(res.error));
    },
  });
}

export function useUpdateAmlSuspiciousReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().suspiciousReports.update(token(), id, payload),
    onSuccess: (res, vars) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['aml-suspicious-reports'] });
        qc.invalidateQueries({ queryKey: ['aml-suspicious-report', vars.id] });
        toast.success('Déclaration mise à jour');
      } else toast.error(String(res.error));
    },
  });
}

export function useTransmitAmlSuspiciousReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().suspiciousReports.transmit(token(), id, payload),
    onSuccess: (res, vars) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['aml-suspicious-reports'] });
        qc.invalidateQueries({ queryKey: ['aml-suspicious-report', vars.id] });
        toast.success('Déclaration transmise à la CENTIF');
      } else toast.error(String(res.error));
    },
  });
}

export function useClassifyAmlSuspiciousReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().suspiciousReports.classify(token(), id, payload),
    onSuccess: (res, vars) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['aml-suspicious-reports'] });
        qc.invalidateQueries({ queryKey: ['aml-suspicious-report', vars.id] });
        toast.success('Déclaration classée sans suite');
      } else toast.error(String(res.error));
    },
  });
}

/* ─── Formations du personnel ──────────────────────────────── */

export function useAmlTrainings(filters: object = {}, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['aml-trainings', filters, page],
    queryFn: () => ipc().training.list(token(), filters, page, limit),
  });
}

export function useAmlTraining(id?: number) {
  return useQuery({
    queryKey: ['aml-training', id],
    queryFn: () => ipc().training.getById(token(), id!),
    enabled: !!id,
  });
}

export function useCreateAmlTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().training.create(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['aml-trainings'] }); toast.success('Formation enregistrée'); }
      else toast.error(String(res.error));
    },
  });
}

export function useUpdateAmlTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().training.update(token(), id, payload),
    onSuccess: (res, vars) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['aml-trainings'] });
        qc.invalidateQueries({ queryKey: ['aml-training', vars.id] });
        toast.success('Formation mise à jour');
      } else toast.error(String(res.error));
    },
  });
}

export function useDeleteAmlTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().training.delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['aml-trainings'] }); toast.success('Formation supprimée'); }
      else toast.error(String(res.error));
    },
  });
}

/* ─── Tableau de bord ──────────────────────────────────────── */

export function useAmlDashboard() {
  return useQuery({ queryKey: ['aml-dashboard'], queryFn: () => ipc().dashboard(token()) });
}
