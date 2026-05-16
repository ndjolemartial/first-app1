import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';

const ipc = window.electron.accounting;

export function useAccountingDashboard() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['accounting', 'dashboard'],
    queryFn: () => ipc.getDashboard(token),
  });
}

export function useInvoices(filters: object = {}, page = 1, limit = 20) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['invoices', filters, page],
    queryFn: () => ipc.getInvoices(token, filters, page, limit),
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

export function useUpcomingInstallments(days = 30) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['installments', 'upcoming', days],
    queryFn: () => ipc.getUpcomingInstallments(token, days),
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

export function useSaleContracts() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['accounting', 'sale-contracts'],
    queryFn: () => ipc.getSaleContracts(token),
  });
}
