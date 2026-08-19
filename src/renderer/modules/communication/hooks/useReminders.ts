import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';

const ipc = () => window.electron.reminders;

export function useReminderPolicy() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['reminders-policy'],
    queryFn: () => ipc().getPolicy(token),
    enabled: !!token,
  });
}

export function useUpdateReminderPolicy() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().updatePolicy(token, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders-policy'] }),
  });
}

export function useReminderRules() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['reminder-rules'],
    queryFn: () => ipc().listRules(token),
    enabled: !!token,
  });
}

export function useUpdateReminderRule() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) =>
      ipc().updateRule(token, id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminder-rules'] }),
  });
}

export function useCreateReminderRule() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().createRule(token, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminder-rules'] }),
  });
}

/** Suppression définitive — irréversible (contrairement à la désactivation `isActive`). */
export function useDeleteReminderRule() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().deleteRule(token, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminder-rules'] }),
  });
}

export function useRunRemindersNow() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => ipc().runNow(token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comm-history'] });
      qc.invalidateQueries({ queryKey: ['crm-activities'] });
    },
  });
}

export function useOptedOutClients() {
  const token = useAuthStore((s) => s.token)!;
  return useQuery({
    queryKey: ['reminders-opted-out-clients'],
    queryFn: () => ipc().listOptedOutClients(token),
    enabled: !!token,
  });
}

export function useSetClientOptOut() {
  const token = useAuthStore((s) => s.token)!;
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { clientId: number; smsOptOut?: boolean; emailOptOut?: boolean }) =>
      ipc().setClientOptOut(token, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders-opted-out-clients'] }),
  });
}
