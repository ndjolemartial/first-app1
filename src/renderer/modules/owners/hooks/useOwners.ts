import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.owners;

export function useOwners(filters?: object, page = 1, limit = 20) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['owners', filters, page],
    queryFn: () => ipc().list(token, filters, page, limit),
    enabled: !!token,
  });
}

export function useOwner(id: number) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['owners', id],
    queryFn: () => ipc().getById(token, id),
    enabled: !!token && !!id,
  });
}

export function useOwnerPortfolio(id: number) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['owners', id, 'portfolio'],
    queryFn: () => ipc().portfolio(token, id),
    enabled: !!token && !!id,
  });
}

export function useCreateOwner() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().create(token, payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['owners'] }); toast.success('Propriétaire créé'); }
      else toast.error(String(res.error));
    },
  });
}

export function useUpdateOwner() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().update(token, id, payload),
    onSuccess: (res, { id }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['owners'] });
        qc.invalidateQueries({ queryKey: ['owners', id] });
        toast.success('Propriétaire mis à jour');
      } else toast.error(String(res.error));
    },
  });
}

export function useDeleteOwner() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().delete(token, id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['owners'] }); toast.success('Propriétaire supprimé'); }
      else toast.error(String(res.error));
    },
  });
}
