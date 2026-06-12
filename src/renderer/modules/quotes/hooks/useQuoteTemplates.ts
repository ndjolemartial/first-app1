import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.quoteTemplates;
const token = () => useAuthStore.getState().token!;

export function useQuoteTemplates(filters: object = {}) {
  return useQuery({
    queryKey: ['quote-templates', filters],
    queryFn: () => ipc().list(token(), filters, 1, 100),
  });
}

export function useQuoteTemplate(id: number) {
  return useQuery({
    queryKey: ['quote-template', id],
    queryFn: () => ipc().getById(token(), id),
    enabled: id > 0,
  });
}

export function useCreateQuoteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().create(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['quote-templates'] }); toast.success('Modèle créé'); }
      else toast.error(String(res.error));
    },
  });
}

export function useUpdateQuoteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().update(token(), id, payload),
    onSuccess: (res, { id }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['quote-templates'] });
        qc.invalidateQueries({ queryKey: ['quote-template', id] });
        toast.success('Modèle mis à jour');
      } else toast.error(String(res.error));
    },
  });
}

export function useDeleteQuoteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['quote-templates'] }); toast.success('Modèle supprimé'); }
      else toast.error(String(res.error));
    },
  });
}
