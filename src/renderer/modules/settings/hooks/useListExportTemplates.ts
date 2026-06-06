import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.listExportTemplates;

/** Liste le(s) modèle(s) d'export de listes (PDF / Excel). */
export function useListExportTemplates() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['list-export-templates'],
    queryFn: async () => {
      const r = await ipc().list(token);
      if (!r.success) {
        throw new Error(typeof r.error === 'string' ? r.error : "Erreur modèles d'export");
      }
      return r;
    },
    enabled: !!token,
  });
}

export function useUpdateListExportTemplate() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().update(token, id, payload),
    onSuccess: (r) => {
      if (r.success) {
        qc.invalidateQueries({ queryKey: ['list-export-templates'] });
        toast.success('Modèle enregistré');
      } else {
        toast.error(typeof r.error === 'string' ? r.error : "Erreur lors de l'enregistrement");
      }
    },
    onError: () => toast.error('Erreur réseau'),
  });
}
