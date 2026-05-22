import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.prospects;

export function useProspects(filters?: object, page = 1, limit = 20) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['prospects', filters, page],
    queryFn:  async () => {
      const res = await ipc().list(token, filters, page, limit);
      if (!res.success) throw new Error(typeof res.error === 'string' ? res.error : 'Erreur liste prospects');
      return res;
    },
    enabled:  !!token,
  });
}

export function useProspectKanban() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['prospects', 'kanban'],
    queryFn:  async () => {
      const res = await ipc().kanban(token);
      if (!res.success) throw new Error(typeof res.error === 'string' ? res.error : 'Erreur kanban');
      return res;
    },
    enabled:  !!token,
  });
}

export function useProspect(id: number) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['prospects', id],
    queryFn:  () => ipc().getById(token, id),
    enabled:  !!token && id > 0,
  });
}

export function useCreateProspect() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().create(token, payload),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['prospects'] });
        toast.success('Prospect créé avec succès');
      } else {
        toast.error(typeof res.error === 'string' ? res.error : 'Erreur lors de la création');
      }
    },
    onError: () => toast.error('Erreur réseau'),
  });
}

export function useUpdateProspect() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) =>
      ipc().update(token, id, payload),
    onSuccess: (res, { id }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['prospects'] });
        qc.invalidateQueries({ queryKey: ['prospects', id] });
        toast.success('Prospect mis à jour');
      } else {
        toast.error(typeof res.error === 'string' ? res.error : 'Erreur lors de la mise à jour');
      }
    },
    onError: () => toast.error('Erreur réseau'),
  });
}

export function useDeleteProspect() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().delete(token, id),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['prospects'] });
        toast.success('Prospect supprimé');
      } else {
        toast.error(typeof res.error === 'string' ? res.error : 'Erreur lors de la suppression');
      }
    },
  });
}

export function useUpdateProspectStatus() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      ipc().updateStatus(token, id, status),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['prospects'] });
      } else {
        toast.error(typeof res.error === 'string' ? res.error : 'Erreur statut');
      }
    },
  });
}

export function useConvertProspect() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, clientData }: { id: number; clientData?: object }) =>
      ipc().convertToClient(token, id, clientData),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['prospects'] });
        qc.invalidateQueries({ queryKey: ['clients'] });
        toast.success('Prospect converti en client');
      } else {
        toast.error(typeof res.error === 'string' ? res.error : 'Erreur lors de la conversion');
      }
    },
  });
}

/**
 * Liste des utilisateurs candidats à l'affectation d'un prospect.
 * L'IPC renvoie une 'Permission insuffisante' aux rôles non habilités —
 * le hook est désactivé tant que `enabled = false`.
 */
export function useAssignableUsers(enabled = true) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['prospects', 'assignableUsers'],
    queryFn:  async () => {
      const res = await ipc().listAssignableUsers(token);
      if (!res.success) throw new Error(typeof res.error === 'string' ? res.error : 'Erreur liste utilisateurs');
      return res.data as Array<{ id: number; firstName: string; lastName: string; email: string; role: string }>;
    },
    enabled: !!token && enabled,
  });
}

export function useAssignProspect() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, assignedToId }: { id: number; assignedToId: number | null }) =>
      ipc().assign(token, id, assignedToId),
    onSuccess: (res, { id }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['prospects'] });
        qc.invalidateQueries({ queryKey: ['prospects', id] });
        toast.success('Affectation mise à jour');
      } else {
        toast.error(typeof res.error === 'string' ? res.error : 'Erreur d’affectation');
      }
    },
    onError: () => toast.error('Erreur réseau'),
  });
}
