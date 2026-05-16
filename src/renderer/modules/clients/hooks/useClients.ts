import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.clients;

export function useClients(filters?: object, page = 1, limit = 20) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['clients', filters, page],
    queryFn: () => ipc().list(token, filters, page, limit),
    enabled: !!token,
  });
}

export function useClient(id: number) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['clients', id],
    queryFn: () => ipc().getById(token, id),
    enabled: !!token && !!id,
  });
}

export function useCreateClient() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().create(token, payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success('Client créé'); }
      else toast.error(String(res.error));
    },
  });
}

export function useUpdateClient() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().update(token, id, payload),
    onSuccess: (res, { id }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['clients'] });
        qc.invalidateQueries({ queryKey: ['clients', id] });
        toast.success('Client mis à jour');
      } else toast.error(String(res.error));
    },
  });
}

export function useDeleteClient() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().delete(token, id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success('Client supprimé'); }
      else toast.error(String(res.error));
    },
  });
}

export function useToggleClientActive() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().toggleActive(token, id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success('Statut mis à jour'); }
      else toast.error(String(res.error));
    },
  });
}

export function useUpdateClientStatus() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      ipc().updateStatus(token, id, status),
    onSuccess: (res, { id }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['clients'] });
        qc.invalidateQueries({ queryKey: ['clients', id] });
        toast.success('Statut mis à jour');
      } else toast.error(String(res.error));
    },
  });
}
