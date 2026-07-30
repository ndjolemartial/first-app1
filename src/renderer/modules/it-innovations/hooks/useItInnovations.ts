import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.innovations;
const token = () => useAuthStore.getState().token!;

export function useInnovations(filters: object = {}, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['it-innovations', filters, page],
    queryFn: () => ipc().list(token(), filters, page, limit),
  });
}

export function useInnovation(id: number) {
  return useQuery({
    queryKey: ['it-innovation', id],
    queryFn: () => ipc().getById(token(), id),
    enabled: !!id,
  });
}

export function useInnovationEmployees(enabled = true) {
  return useQuery({
    queryKey: ['it-innovation-employees'],
    queryFn: () => ipc().employees(token()),
    enabled,
  });
}

export function useCreateInnovation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().create(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['it-innovations'] }); toast.success('Innovation enregistrée'); }
      else toast.error(String(res.error));
    },
  });
}

export function useUpdateInnovation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().update(token(), id, payload),
    onSuccess: (res, vars) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['it-innovations'] });
        qc.invalidateQueries({ queryKey: ['it-innovation', vars.id] });
        toast.success('Innovation mise à jour');
      } else toast.error(String(res.error));
    },
  });
}

export function useSubmitPhase2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().submitPhase2(token(), id, payload),
    onSuccess: (res, vars) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['it-innovations'] });
        qc.invalidateQueries({ queryKey: ['it-innovation', vars.id] });
        toast.success('Phase 2 soumise pour validation');
      } else toast.error(String(res.error));
    },
  });
}

export function useSubmitPhase3() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().submitPhase3(token(), id, payload),
    onSuccess: (res, vars) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['it-innovations'] });
        qc.invalidateQueries({ queryKey: ['it-innovation', vars.id] });
        toast.success('Phase 3 soumise pour validation');
      } else toast.error(String(res.error));
    },
  });
}

export function useValidatePhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().validatePhase(token(), id, payload),
    onSuccess: (res, vars) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['it-innovations'] });
        qc.invalidateQueries({ queryKey: ['it-innovation', vars.id] });
        toast.success('Décision enregistrée');
      } else toast.error(String(res.error));
    },
  });
}

export function useDeleteInnovation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['it-innovations'] }); toast.success('Innovation supprimée'); }
      else toast.error(String(res.error));
    },
  });
}

export function useRemoveAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, documentId }: { id: number; documentId: number }) => ipc().removeAttachment(token(), id, documentId),
    onSuccess: (res, vars) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['it-innovation', vars.id] });
        qc.invalidateQueries({ queryKey: ['it-innovations'] });
        toast.success('Pièce jointe supprimée');
      } else toast.error(String(res.error));
    },
  });
}
