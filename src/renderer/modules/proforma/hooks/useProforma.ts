import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.proforma;
const token = () => useAuthStore.getState().token!;

export function useProformaInvoices(filters: object = {}, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['proforma', filters, page],
    queryFn: () => ipc().list(token(), filters, page, limit),
  });
}

export function useProformaInvoice(id: number) {
  return useQuery({
    queryKey: ['proforma-invoice', id],
    queryFn: () => ipc().getById(token(), id),
    enabled: id > 0,
  });
}

export function useCreateProformaFromQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().createFromQuote(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['proforma'] }); toast.success('Facture Proforma générée'); }
      else toast.error(String(res.error));
    },
  });
}

export function useCreateProformaFromConvention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().createFromConvention(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['proforma'] }); toast.success('Facture Proforma générée'); }
      else toast.error(String(res.error));
    },
  });
}

export function useDeleteProformaInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['proforma'] }); toast.success('Facture Proforma supprimée'); }
      else toast.error(String(res.error));
    },
  });
}
