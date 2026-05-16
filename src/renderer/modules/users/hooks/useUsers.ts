import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.users;

export function useUsers(filters?: object, page = 1, limit = 20) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['users', filters, page],
    queryFn: () => ipc().list(token, filters, page, limit),
    enabled: !!token,
  });
}

export function useUser(id: number) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => ipc().getById(token, id),
    enabled: !!token && !!id,
  });
}

export function useCreateUser() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().create(token, payload),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['users'] });
        toast.success('Utilisateur créé avec succès');
      } else toast.error(String(res.error));
    },
  });
}

export function useUpdateUser() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) =>
      ipc().update(token, id, payload),
    onSuccess: (res, { id }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['users'] });
        qc.invalidateQueries({ queryKey: ['users', id] });
        toast.success('Utilisateur mis à jour');
      } else toast.error(String(res.error));
    },
  });
}

export function useResetPassword() {
  const token = useAuthStore((s) => s.token)!;
  return useMutation({
    mutationFn: ({ id, newPassword }: { id: number; newPassword: string }) =>
      ipc().resetPassword(token, id, newPassword),
    onSuccess: (res) => {
      if (res.success) toast.success('Mot de passe réinitialisé');
      else toast.error(String(res.error));
    },
  });
}

export function useToggleUserActive() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().toggleActive(token, id),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['users'] });
        toast.success('Statut mis à jour');
      } else toast.error(String(res.error));
    },
  });
}
