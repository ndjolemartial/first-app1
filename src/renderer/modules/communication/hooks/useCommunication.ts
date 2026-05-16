import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';

const ipc = window.electron.communication;

export function useTemplates(channel?: string) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['comm-templates', channel],
    queryFn: () => ipc.listTemplates(token, channel),
  });
}

export function useTemplate(id: number) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['comm-templates', id],
    queryFn: () => ipc.getTemplate(token, id),
    enabled: id > 0,
  });
}

export function useCreateTemplate() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc.createTemplate(token, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comm-templates'] }),
  });
}

export function useUpdateTemplate() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) =>
      ipc.updateTemplate(token, id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comm-templates'] }),
  });
}

export function useDeleteTemplate() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc.deleteTemplate(token, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comm-templates'] }),
  });
}

export function useCommunicationHistory(filters: object = {}, page = 1, limit = 30) {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['comm-history', filters, page],
    queryFn: () => ipc.getHistory(token, filters, page, limit),
  });
}

export function useSendEmail() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc.sendEmail(token, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comm-history'] }),
  });
}

export function useSendSms() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc.sendSms(token, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comm-history'] }),
  });
}
