import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.hr;
const token = () => useAuthStore.getState().token!;

/* ─── Personnel ───────────────────────────────────────────────── */

export function useEmployees(filters: object = {}, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['employees', filters, page],
    queryFn: () => ipc().employees.list(token(), filters, page, limit),
  });
}

export function useEmployee(id: number) {
  return useQuery({
    queryKey: ['employee', id],
    queryFn: () => ipc().employees.getById(token(), id),
    enabled: id > 0,
  });
}

export function useLinkableUsers(excludeEmployeeId?: number) {
  return useQuery({
    queryKey: ['hr-linkable-users', excludeEmployeeId ?? 0],
    queryFn: () => ipc().employees.linkableUsers(token(), excludeEmployeeId),
  });
}

export function useEmployeesStats() {
  return useQuery({
    queryKey: ['employees', 'stats'],
    queryFn: () => ipc().employees.stats(token()),
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().employees.create(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['employees'] }); toast.success('Employé créé'); }
      else toast.error(String(res.error));
    },
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().employees.update(token(), id, payload),
    onSuccess: (res, { id }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['employees'] });
        qc.invalidateQueries({ queryKey: ['employee', id] });
        toast.success('Employé mis à jour');
      } else toast.error(String(res.error));
    },
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().employees.delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['employees'] }); toast.success('Employé archivé'); }
      else toast.error(String(res.error));
    },
  });
}

/* ─── Contrats de travail ─────────────────────────────────────── */

export function useCreateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().contracts.create(token(), payload),
    onSuccess: (res, payload: any) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['employee', payload.employeeId] });
        qc.invalidateQueries({ queryKey: ['employees'] });
        toast.success('Contrat créé');
      } else toast.error(String(res.error));
    },
  });
}

export function useUpdateContract(employeeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().contracts.update(token(), id, payload),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['employee', employeeId] });
        toast.success('Contrat mis à jour');
      } else toast.error(String(res.error));
    },
  });
}

export function useDeleteContract(employeeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().contracts.delete(token(), id),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['employee', employeeId] });
        toast.success('Contrat supprimé');
      } else toast.error(String(res.error));
    },
  });
}

/** Données de rendu d'un contrat (contrat + employé + entreprise). */
export function useContractRenderData(id: number) {
  return useQuery({
    queryKey: ['contract-render', id],
    queryFn: () => ipc().contracts.getRenderData(token(), id),
    enabled: id > 0,
  });
}

/* ─── Paie / bulletins ────────────────────────────────────────── */

export function usePayslips(filters: object = {}, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['payslips', filters, page],
    queryFn: () => ipc().payslips.list(token(), filters, page, limit),
  });
}

export function usePayslip(id: number) {
  return useQuery({
    queryKey: ['payslip', id],
    queryFn: () => ipc().payslips.getById(token(), id),
    enabled: id > 0,
  });
}

export function useGeneratePayslip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().payslips.generate(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['payslips'] }); toast.success('Bulletin généré'); }
      else toast.error(String(res.error));
    },
  });
}

export function useUpdatePayslip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().payslips.update(token(), id, payload),
    onSuccess: (res, { id }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['payslips'] });
        qc.invalidateQueries({ queryKey: ['payslip', id] });
        toast.success('Bulletin modifié');
      } else toast.error(String(res.error));
    },
  });
}

export function usePayslipPayAccounts() {
  return useQuery({
    queryKey: ['payslip-pay-accounts'],
    queryFn: () => ipc().payslips.payAccounts(token()),
  });
}

export function useUpdatePayslipStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, paymentMethod, paidAt, bankAccountId }: { id: number; status: string; paymentMethod?: string; paidAt?: string; bankAccountId?: number }) =>
      ipc().payslips.updateStatus(token(), id, status, paymentMethod, paidAt, bankAccountId),
    onSuccess: (res, { id }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['payslips'] });
        qc.invalidateQueries({ queryKey: ['payslip', id] });
        qc.invalidateQueries({ queryKey: ['treasury'] });
        toast.success('Bulletin mis à jour');
      } else toast.error(String(res.error));
    },
  });
}

export function useUpdatePayslipPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paidAt, paymentMethod, bankAccountId }: { id: number; paidAt?: string; paymentMethod?: string; bankAccountId?: number }) =>
      ipc().payslips.updatePayment(token(), id, paidAt, paymentMethod, bankAccountId),
    onSuccess: (res, { id }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['payslips'] });
        qc.invalidateQueries({ queryKey: ['payslip', id] });
        qc.invalidateQueries({ queryKey: ['treasury'] });
        toast.success('Paiement mis à jour');
      } else toast.error(String(res.error));
    },
  });
}

export function useDeletePayslip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().payslips.delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['payslips'] }); toast.success('Bulletin supprimé'); }
      else toast.error(String(res.error));
    },
  });
}

export function usePrintPayslip() {
  return useMutation({
    mutationFn: (id: number) => ipc().payslips.print(token(), id),
    onSuccess: (res) => { if (!res.success) toast.error(String(res.error)); },
  });
}

export function usePayrollRates() {
  return useQuery({
    queryKey: ['payroll-rates'],
    queryFn: () => ipc().payroll.getRates(token()),
  });
}

export function useSetPayrollRates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rates: object) => ipc().payroll.setRates(token(), rates),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['payroll-rates'] }); toast.success('Taux de paie enregistrés'); }
      else toast.error(String(res.error));
    },
  });
}

/* ─── Modèles (contrats & bulletins) ──────────────────────────── */

export function useContractTemplates() {
  return useQuery({
    queryKey: ['contract-templates'],
    queryFn: () => ipc().contractTemplates.list(token()),
  });
}

export function useSaveContractTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: object }) =>
      id ? ipc().contractTemplates.update(token(), id, payload) : ipc().contractTemplates.create(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['contract-templates'] }); toast.success('Modèle de contrat enregistré'); }
      else toast.error(String(res.error));
    },
  });
}

export function useDeleteContractTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().contractTemplates.delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['contract-templates'] }); toast.success('Modèle supprimé'); }
      else toast.error(String(res.error));
    },
  });
}

/* ─── Catégories socio-professionnelles & délais d'essai ───────── */

export function useEssaiCategories(includeInactive = false) {
  return useQuery({
    queryKey: ['essai-categories', includeInactive],
    queryFn: () => ipc().essaiCategories.list(token(), includeInactive),
  });
}

export function useSaveEssaiCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: object }) =>
      id ? ipc().essaiCategories.update(token(), id, payload) : ipc().essaiCategories.create(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['essai-categories'] }); toast.success('Catégorie enregistrée'); }
      else toast.error(String(res.error));
    },
  });
}

export function useDeleteEssaiCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().essaiCategories.delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['essai-categories'] }); toast.success('Catégorie supprimée'); }
      else toast.error(String(res.error));
    },
  });
}

/* ─── Fonctions de l'employé (référentiel) ────────────────────── */

export function useContractFunctions(includeInactive = false) {
  return useQuery({
    queryKey: ['contract-functions', includeInactive],
    queryFn: () => ipc().contractFunctions.list(token(), includeInactive),
  });
}

/* ─── Commissions sur activité (catalogue avec taux par défaut) ── */

export function useCommissionActivities() {
  return useQuery({
    queryKey: ['commission-activities'],
    queryFn: () => ipc().commissionActivities.list(token()),
  });
}

export function useSaveContractFunction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: object }) =>
      id ? ipc().contractFunctions.update(token(), id, payload) : ipc().contractFunctions.create(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['contract-functions'] }); toast.success('Fonction enregistrée'); }
      else toast.error(String(res.error));
    },
  });
}

export function useDeleteContractFunction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().contractFunctions.delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['contract-functions'] }); toast.success('Fonction supprimée'); }
      else toast.error(String(res.error));
    },
  });
}

/* ─── Objectifs assignés (référentiel) ────────────────────────── */

export function useContractObjectives(includeInactive = false) {
  return useQuery({
    queryKey: ['contract-objectives', includeInactive],
    queryFn: () => ipc().contractObjectives.list(token(), includeInactive),
  });
}

export function useSaveContractObjective() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: object }) =>
      id ? ipc().contractObjectives.update(token(), id, payload) : ipc().contractObjectives.create(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['contract-objectives'] }); toast.success('Objectifs enregistrés'); }
      else toast.error(String(res.error));
    },
  });
}

export function useDeleteContractObjective() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().contractObjectives.delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['contract-objectives'] }); toast.success('Objectifs supprimés'); }
      else toast.error(String(res.error));
    },
  });
}

/* ─── Modèles de fiche de poste ────────────────────────────────── */

export function useJobDescriptionTemplates() {
  return useQuery({
    queryKey: ['job-description-templates'],
    queryFn: () => ipc().jobDescriptionTemplates.list(token()),
  });
}

export function useSaveJobDescriptionTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: object }) =>
      id ? ipc().jobDescriptionTemplates.update(token(), id, payload) : ipc().jobDescriptionTemplates.create(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['job-description-templates'] }); toast.success('Modèle de fiche de poste enregistré'); }
      else toast.error(String(res.error));
    },
  });
}

export function useDeleteJobDescriptionTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().jobDescriptionTemplates.delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['job-description-templates'] }); toast.success('Modèle supprimé'); }
      else toast.error(String(res.error));
    },
  });
}

export function usePayslipTemplates() {
  return useQuery({
    queryKey: ['payslip-templates'],
    queryFn: () => ipc().payslipTemplates.list(token()),
  });
}

export function useUpdatePayslipTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().payslipTemplates.update(token(), id, payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['payslip-templates'] }); toast.success('Modèle de bulletin enregistré'); }
      else toast.error(String(res.error));
    },
  });
}

/* ─── Congés & absences ───────────────────────────────────────── */

export function useLeaveTypes() {
  return useQuery({
    queryKey: ['leave-types'],
    queryFn: () => ipc().leaveTypes.list(token()),
  });
}

export function useLeaveRequests(filters: object = {}, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['leave-requests', filters, page],
    queryFn: () => ipc().leaveRequests.list(token(), filters, page, limit),
  });
}

export function useLeaveBalance(employeeId: number) {
  return useQuery({
    queryKey: ['leave-balance', employeeId],
    queryFn: () => ipc().leave.balance(token(), employeeId),
    enabled: employeeId > 0,
  });
}

export function useCreateLeaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().leaveRequests.create(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['leave-requests'] }); toast.success('Demande enregistrée'); }
      else toast.error(String(res.error));
    },
  });
}

export function useDecideLeaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: number; status: string; note?: string }) =>
      ipc().leaveRequests.decide(token(), id, status, note),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['leave-requests'] });
        qc.invalidateQueries({ queryKey: ['leave-balance'] });
        toast.success('Demande mise à jour');
      } else toast.error(String(res.error));
    },
  });
}

export function useDeleteLeaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().leaveRequests.delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['leave-requests'] }); toast.success('Demande supprimée'); }
      else toast.error(String(res.error));
    },
  });
}

/** Ouvre l'aperçu d'impression de la fiche « Congés & Absence » d'une demande. */
export function usePrintLeaveRequest() {
  return useMutation({
    mutationFn: (id: number) => ipc().leaveRequests.print(token(), id),
    onSuccess: (res) => { if (!res.success) toast.error(String(res.error)); },
  });
}

/** Téléverse (scan) la fiche « Congés & Absence » signée d'une demande validée. */
export function useUploadLeaveSigned() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().leaveRequests.uploadSigned(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['leave-requests'] }); toast.success('Fiche signée jointe'); }
      else toast.error(String(res.error));
    },
  });
}

/** Retire la fiche signée jointe à une demande. */
export function useRemoveLeaveSigned() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().leaveRequests.removeSigned(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['leave-requests'] }); toast.success('Fiche signée retirée'); }
      else toast.error(String(res.error));
    },
  });
}

/* ─── Pointage / heures ───────────────────────────────────────── */

export function useAttendance(employeeId: number, year: number, month: number) {
  return useQuery({
    queryKey: ['attendance', employeeId, year, month],
    queryFn: () => ipc().attendance.list(token(), employeeId, year, month),
    enabled: employeeId > 0,
  });
}

export function useAttendanceSummary(employeeId: number, year: number, month: number) {
  return useQuery({
    queryKey: ['attendance-summary', employeeId, year, month],
    queryFn: () => ipc().attendance.summary(token(), employeeId, year, month),
    enabled: employeeId > 0,
  });
}

export function useBulkUpsertAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (records: object[]) => ipc().attendance.bulkUpsert(token(), records),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['attendance'] });
        qc.invalidateQueries({ queryKey: ['attendance-summary'] });
        toast.success('Pointage enregistré');
      } else toast.error(String(res.error));
    },
  });
}

/* ─── Self-service : « Mon espace RH & Paie » (lecture seule) ──── */

export function useMyHrOverview() {
  return useQuery({ queryKey: ['my-hr-overview'], queryFn: () => ipc().me.overview(token()) });
}

export function useMyPayslips() {
  return useQuery({ queryKey: ['my-payslips'], queryFn: () => ipc().me.payslips(token()) });
}

export function useMyPayslip(id: number) {
  return useQuery({ queryKey: ['my-payslip', id], queryFn: () => ipc().me.payslip(token(), id), enabled: id > 0 });
}

export function useMyAttendance(year: number, month: number) {
  return useQuery({ queryKey: ['my-attendance', year, month], queryFn: () => ipc().me.attendance(token(), year, month) });
}

export function useMyLeaveRequests() {
  return useQuery({ queryKey: ['my-leave'], queryFn: () => ipc().me.leaveRequests(token()) });
}

export function useMyContractRenderData(id: number) {
  return useQuery({ queryKey: ['my-contract-render', id], queryFn: () => ipc().me.contractRenderData(token(), id), enabled: id > 0 });
}

export function useMyReglementInterieur() {
  return useQuery({ queryKey: ['my-reglement'], queryFn: () => ipc().me.reglementInterieur(token()) });
}

/* ─── Contrats signés (fichiers téléversés) ───────────────────── */

export function useSignedContracts(employeeId: number) {
  return useQuery({
    queryKey: ['signed-contracts', employeeId],
    queryFn: () => ipc().signedContracts.list(token(), employeeId),
    enabled: employeeId > 0,
  });
}

export function useUploadSignedContract(employeeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().signedContracts.upload(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['signed-contracts', employeeId] }); toast.success('Contrat signé téléversé'); }
      else toast.error(String(res.error));
    },
  });
}

export function useDeleteSignedContract(employeeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().signedContracts.delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['signed-contracts', employeeId] }); toast.success('Contrat signé supprimé'); }
      else toast.error(String(res.error));
    },
  });
}

export function useMySignedContracts() {
  return useQuery({ queryKey: ['my-signed-contracts'], queryFn: () => ipc().me.signedContracts(token()) });
}
