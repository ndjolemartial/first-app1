import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.attestationTemplates;
const token = () => useAuthStore.getState().token!;

export function useAttestationTemplates(filters: object = {}, page = 1, limit = 200) {
  return useQuery({
    queryKey: ['attestationTemplates', filters, page],
    queryFn: () => ipc().list(token(), filters, page, limit),
  });
}

export function useAttestationTemplate(id: number) {
  return useQuery({
    queryKey: ['attestationTemplate', id],
    queryFn: () => ipc().getById(token(), id),
    enabled: id > 0,
  });
}

export function useCreateAttestationTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().create(token(), payload),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['attestationTemplates'] });
        toast.success('Modèle créé');
      } else toast.error(String(res.error));
    },
  });
}

export function useUpdateAttestationTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().update(token(), id, payload),
    onSuccess: (res, { id }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['attestationTemplates'] });
        qc.invalidateQueries({ queryKey: ['attestationTemplate', id] });
        toast.success('Modèle mis à jour');
      } else toast.error(String(res.error));
    },
  });
}

export function useDeleteAttestationTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().delete(token(), id),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['attestationTemplates'] });
        toast.success('Modèle supprimé');
      } else toast.error(String(res.error));
    },
  });
}
