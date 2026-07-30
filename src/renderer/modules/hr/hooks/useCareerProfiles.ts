import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.careerProfiles;
const token = () => useAuthStore.getState().token!;

/** Profils de carrière (filières métier par poste) — paramétrage SUPER_ADMIN/ADMIN. */
export function useCareerProfiles() {
  return useQuery({
    queryKey: ['career-profiles'],
    queryFn: () => ipc().list(token()),
  });
}

export function useCareerProfile(id: number) {
  return useQuery({
    queryKey: ['career-profiles', id],
    queryFn: () => ipc().getById(token(), id),
    enabled: id > 0,
  });
}

export function useCreateCareerProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().create(token(), payload),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['career-profiles'] }); toast.success('Profil de carrière créé'); }
      else toast.error(String(res.error));
    },
  });
}

export function useUpdateCareerProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().update(token(), id, payload),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['career-profiles'] });
        toast.success('Profil de carrière mis à jour');
      } else toast.error(String(res.error));
    },
  });
}

export function useDeleteCareerProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['career-profiles'] }); toast.success('Profil de carrière supprimé'); }
      else toast.error(String(res.error));
    },
  });
}

export function useDuplicateCareerProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().duplicate(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['career-profiles'] }); toast.success('Profil de carrière dupliqué'); }
      else toast.error(String(res.error));
    },
  });
}
