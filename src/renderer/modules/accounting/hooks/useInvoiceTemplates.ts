import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.invoiceTemplates;

/** Liste les 3 modèles de facture et la correspondance type → modèle par défaut. */
export function useInvoiceTemplates() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['invoice-templates'],
    queryFn: async () => {
      const r = await ipc().list(token);
      if (!r.success) throw new Error(typeof r.error === 'string' ? r.error : 'Erreur modèles de facture');
      return r;
    },
    enabled: !!token,
  });
}

export function useUpdateInvoiceTemplate() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().update(token, id, payload),
    onSuccess: (r) => {
      if (r.success) {
        qc.invalidateQueries({ queryKey: ['invoice-templates'] });
        toast.success('Modèle enregistré');
      } else {
        toast.error(typeof r.error === 'string' ? r.error : 'Erreur lors de l\'enregistrement');
      }
    },
    onError: () => toast.error('Erreur réseau'),
  });
}

export function useSetInvoiceTemplateDefaults() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (defaults: Record<string, number>) => ipc().setDefaults(token, defaults),
    onSuccess: (r) => {
      if (r.success) {
        qc.invalidateQueries({ queryKey: ['invoice-templates'] });
        toast.success('Modèles par défaut enregistrés');
      } else {
        toast.error(typeof r.error === 'string' ? r.error : 'Erreur lors de l\'enregistrement');
      }
    },
    onError: () => toast.error('Erreur réseau'),
  });
}
