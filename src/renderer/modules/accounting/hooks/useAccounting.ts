import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = window.electron.accounting;

export function useAccountingDashboard() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['accounting', 'dashboard'],
    queryFn: () => ipc.getDashboard(token),
  });
}

export function useRevenue(period: string) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['accounting', 'revenue', period],
    queryFn: () => ipc.getRevenue(token, period),
  });
}

export function useInvoices(filters: object = {}, page = 1, limit = 20) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['invoices', filters, page],
    queryFn: () => ipc.getInvoices(token, filters, page, limit),
  });
}

export function useInvoiceTypeStats(filters: object = {}) {
  const token = useAuthStore((s) => s.token)!;
  // Clé préfixée par 'invoices' pour bénéficier des invalidations existantes
  // (create / update / pay…). Le filtre `type` est ignoré côté backend.
  return useQuery({
    queryKey: ['invoices', 'type-stats', filters],
    queryFn: () => ipc.getInvoiceTypeStats(token, filters),
  });
}

export function useInvoice(id: number) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['invoices', id],
    queryFn: () => ipc.getInvoiceById(token, id),
    enabled: id > 0,
  });
}

export function useCreateInvoice() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc.createInvoice(token, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

export function useUpdateInvoiceStatus() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      ipc.updateInvoiceStatus(token, id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

/**
 * Réintègre une facture annulée. Le statut cible (BROUILLON / EN_RETARD /
 * PARTIEL / PAYEE) est calculé côté serveur en fonction des paiements et de
 * la date d'échéance, pour préserver la cohérence comptable.
 */
export function useReinstateInvoice() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc.reinstateInvoice(token, id),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['invoices'] });
        // Rafraîchit aussi la fiche terrain (factures ACD rattachées).
        qc.invalidateQueries({ queryKey: ['terrain'] });
        toast.success(`Facture réintégrée — statut: ${res.data?.status ?? ''}`);
      } else toast.error(typeof res.error === 'string' ? res.error : 'Erreur de réintégration');
    },
  });
}

export function useAddPayment() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, payload }: { invoiceId: number; payload: object }) =>
      ipc.addPayment(token, invoiceId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

export function useOverdueInstallments() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['installments', 'overdue'],
    queryFn: () => ipc.getOverdueInstallments(token),
  });
}

export function useUnpaidInstallments() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['installments', 'unpaid'],
    queryFn: () => ipc.getUnpaidInstallments(token),
  });
}

export function useUpcomingInstallments(days = 30) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['installments', 'upcoming', days],
    queryFn: () => ipc.getUpcomingInstallments(token, days),
  });
}

export function usePaidInstallments(year = 0, semester = 0) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['installments', 'paid', year, semester],
    queryFn: () => ipc.getPaidInstallments(token, year, semester),
  });
}

export function useCancelledInstallments() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['installments', 'cancelled'],
    queryFn: () => ipc.getCancelledInstallments(token),
  });
}

/** Liste de toutes les échéances de vente (pour sélecteurs / rattachements). */
export function useAllInstallments() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['installments', 'all'],
    queryFn: () => ipc.listInstallments(token),
  });
}

export function usePayInstallment() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ installmentId, payload }: { installmentId: number; payload: object }) =>
      ipc.payInstallment(token, installmentId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['installments'] });
      qc.invalidateQueries({ queryKey: ['accounting', 'dashboard'] });
    },
  });
}

export function useCancelInstallment() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (installmentId: number) => ipc.cancelInstallment(token, installmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['installments'] });
      qc.invalidateQueries({ queryKey: ['accounting', 'dashboard'] });
    },
  });
}

export function useReinstateInstallment() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (installmentId: number) => ipc.reinstateInstallment(token, installmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['installments'] });
      qc.invalidateQueries({ queryKey: ['accounting', 'dashboard'] });
    },
  });
}

/** Génère et enregistre le PDF d'une facture, avec retour utilisateur (toast). */
export function usePrintInvoice() {
  const token = useAuthStore((s) => s.token)!;
  return async (invoiceId: number) => {
    try {
      const r = await ipc.printInvoice(token, invoiceId);
      if (!r.success) {
        toast.error(typeof r.error === 'string' ? r.error : "Erreur lors de l'impression");
      } else if (!r.data?.canceled) {
        toast.success('Facture enregistrée en PDF');
      }
    } catch {
      toast.error("Erreur lors de l'impression de la facture");
    }
  };
}

export function useSaleConventions() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['accounting', 'sale-conventions'],
    queryFn: () => ipc.getSaleConventions(token),
  });
}
