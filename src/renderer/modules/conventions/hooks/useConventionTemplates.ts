import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.conventionTemplates;
const token = () => useAuthStore.getState().token!;

export function useConventionTemplates(filters: object = {}, page = 1, limit = 200) {
  return useQuery({
    queryKey: ['conventionTemplates', filters, page],
    queryFn: () => ipc().list(token(), filters, page, limit),
  });
}

export function useConventionTemplate(id: number) {
  return useQuery({
    queryKey: ['conventionTemplate', id],
    queryFn: () => ipc().getById(token(), id),
    enabled: id > 0,
  });
}

export function useCreateConventionTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().create(token(), payload),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['conventionTemplates'] });
        toast.success('Modèle créé');
      } else toast.error(String(res.error));
    },
  });
}

export function useUpdateConventionTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().update(token(), id, payload),
    onSuccess: (res, { id }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['conventionTemplates'] });
        qc.invalidateQueries({ queryKey: ['conventionTemplate', id] });
        toast.success('Modèle mis à jour');
      } else toast.error(String(res.error));
    },
  });
}

export function useDeleteConventionTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().delete(token(), id),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['conventionTemplates'] });
        toast.success('Modèle supprimé');
      } else toast.error(String(res.error));
    },
  });
}
