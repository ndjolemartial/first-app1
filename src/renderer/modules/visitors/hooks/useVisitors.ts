import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.visitors;
const token = () => useAuthStore.getState().token!;

export function useVisitors(filters: object = {}, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['visitors', filters, page],
    queryFn: () => ipc().list(token(), filters, page, limit),
  });
}

export function useVisitor(id: number) {
  return useQuery({
    queryKey: ['visitor', id],
    queryFn: () => ipc().getById(token(), id),
    enabled: id > 0,
  });
}

export function useVisitorsStats() {
  return useQuery({
    queryKey: ['visitors', 'stats'],
    queryFn: () => ipc().stats(token()),
  });
}

export function useCreateVisitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().create(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['visitors'] }); toast.success('Visiteur enregistré'); }
      else toast.error(String(res.error));
    },
  });
}

export function useUpdateVisitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().update(token(), id, payload),
    onSuccess: (res, { id }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['visitors'] });
        qc.invalidateQueries({ queryKey: ['visitor', id] });
        toast.success('Visiteur mis à jour');
      } else toast.error(String(res.error));
    },
  });
}

export function useDeleteVisitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['visitors'] }); toast.success('Visiteur supprimé'); }
      else toast.error(String(res.error));
    },
  });
}

/* ─── Objets de visite (liste paramétrable) ───────────────────── */

export function useVisitObjects(includeInactive = false) {
  return useQuery({
    queryKey: ['visit-objects', includeInactive],
    queryFn: () => ipc().listObjects(token(), includeInactive),
  });
}

export function useCreateVisitObject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (label: string) => ipc().createObject(token(), label),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['visit-objects'] }); toast.success('Objet de visite ajouté'); }
      else toast.error(String(res.error));
    },
  });
}

export function useUpdateVisitObject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().updateObject(token(), id, payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['visit-objects'] }); toast.success('Objet de visite mis à jour'); }
      else toast.error(String(res.error));
    },
  });
}

export function useDeleteVisitObject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().deleteObject(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['visit-objects'] }); toast.success('Objet de visite supprimé'); }
      else toast.error(String(res.error));
    },
  });
}
