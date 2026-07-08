import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.quotes;
const token = () => useAuthStore.getState().token!;

export function useQuotes(filters: object = {}, page = 1, limit = 50) {
  return useQuery({
    queryKey: ['quotes', filters, page],
    queryFn: () => ipc().list(token(), filters, page, limit),
  });
}

export function useQuote(id: number) {
  return useQuery({
    queryKey: ['quote', id],
    queryFn: () => ipc().getById(token(), id),
    enabled: id > 0,
  });
}

export function useQuotesStats() {
  return useQuery({
    queryKey: ['quotes', 'stats'],
    queryFn: () => ipc().stats(token()),
  });
}

export function useCreateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().create(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['quotes'] }); toast.success('Devis créé'); }
      else toast.error(String(res.error));
    },
  });
}

export function useUpdateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().update(token(), id, payload),
    onSuccess: (res, { id }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['quotes'] });
        qc.invalidateQueries({ queryKey: ['quote', id] });
        toast.success('Devis mis à jour');
      } else toast.error(String(res.error));
    },
  });
}

/** Transition de statut (send/accept/refuse/cancel) ou conversion. */
function useQuoteAction(
  action: (id: number, arg?: any) => Promise<any>,
  successMsg: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, arg }: { id: number; arg?: any }) => action(id, arg),
    onSuccess: (res, { id }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['quotes'] });
        qc.invalidateQueries({ queryKey: ['quote', id] });
        toast.success(successMsg);
      } else toast.error(String(res.error));
    },
  });
}

export const useSendQuote = () => useQuoteAction((id) => ipc().send(token(), id), 'Devis envoyé');
export const useAcceptQuote = () => useQuoteAction((id) => ipc().accept(token(), id), 'Devis accepté');
export const useRefuseQuote = () => useQuoteAction((id, reason) => ipc().refuse(token(), id, reason), 'Devis refusé');
export const useCancelQuote = () => useQuoteAction((id) => ipc().cancel(token(), id), 'Devis annulé');
export const useConvertQuote = () => useQuoteAction((id, options) => ipc().convert(token(), id, options ?? {}), 'Devis converti');

export function useDeleteQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['quotes'] }); toast.success('Devis supprimé'); }
      else toast.error(String(res.error));
    },
  });
}

/* ─── Unités de mesure (référentiel partagé) ────────────────────── */

export function useQuoteUnits(includeInactive = false) {
  return useQuery({
    queryKey: ['quote-units', includeInactive],
    queryFn: () => ipc().listUnits(token(), includeInactive),
  });
}

export function useSaveQuoteUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: object }) =>
      id ? ipc().updateUnit(token(), id, payload) : ipc().createUnit(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['quote-units'] }); toast.success('Unité enregistrée'); }
      else toast.error(String(res.error));
    },
  });
}

export function useDeleteQuoteUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().deleteUnit(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['quote-units'] }); toast.success('Unité supprimée'); }
      else toast.error(String(res.error));
    },
  });
}
