import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.mailAccount;

/** Boîte email personnelle (self-service) de l'utilisateur connecté. */
export function useMailAccount() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['mailAccount', 'me'],
    queryFn:  () => ipc().get(token),
    enabled:  !!token,
  });
}

export function useUpsertMailAccount() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().upsert(token, payload),
    onSuccess:  (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['mailAccount', 'me'] }); toast.success('Boîte email personnelle enregistrée'); }
      else toast.error(String(res.error));
    },
  });
}

export function useTestMailAccount() {
  const token = useAuthStore((s) => s.token)!;
  return useMutation({
    mutationFn: (payload?: object) => ipc().test(token, payload),
    onSuccess:  (res) => {
      if (res.success) toast.success('Connexion IMAP réussie');
      else toast.error(String(res.error));
    },
  });
}

export function useDeleteMailAccount() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => ipc().delete(token),
    onSuccess:  (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['mailAccount', 'me'] }); toast.success('Boîte email personnelle supprimée'); }
      else toast.error(String(res.error));
    },
  });
}
