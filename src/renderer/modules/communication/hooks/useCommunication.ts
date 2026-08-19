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

/** Droits de l'utilisateur connecté sur les modèles de messages (accès manuel désigné). */
export function useMyTemplatePermissions() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['comm-templates', 'my-permissions'],
    queryFn: () => ipc.myTemplatePermissions(token),
    enabled: !!token,
  });
}

export function useCommunicationHistory(filters: object = {}, page = 1, limit = 20) {
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?.id ?? 0);
  return useQuery({
    // userId dans la clé : refetch propre quand l'auth s'hydrate ou change.
    queryKey: ['comm-history', userId, filters, page],
    queryFn: () => ipc.getHistory(token!, filters, page, limit),
    enabled: !!token,
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

export function useSendWhatsapp() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc.sendWhatsapp(token, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comm-history'] }),
  });
}

export function useResendCommunication() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc.resend(token, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comm-history'] }),
  });
}

/** Supprime un message en échec (les envois réussis ne sont pas supprimables). */
export function useDeleteCommunication() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc.deleteMessage(token, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comm-history'] }),
  });
}

/** Rattache manuellement une réponse entrante non appariée automatiquement. */
/** Marque un message reçu comme lu (sans effet si déjà lu ou si c'est un envoi). */
export function useMarkCommunicationRead() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc.markRead(token, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comm-history'] }),
  });
}

export function useLinkInboundCommunication() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc.linkInbound(token, id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comm-history'] }),
  });
}
