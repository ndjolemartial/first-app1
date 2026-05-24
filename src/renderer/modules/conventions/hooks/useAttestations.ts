import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.attestations;
const token = () => useAuthStore.getState().token!;

export function useAttestations(filters: object = {}, page = 1, limit = 50) {
  return useQuery({
    queryKey: ['attestations', filters, page],
    queryFn: () => ipc().list(token(), filters, page, limit),
  });
}

export function useAttestation(id: number) {
  return useQuery({
    queryKey: ['attestation', id],
    queryFn: () => ipc().getById(token(), id),
    enabled: id > 0,
  });
}

export function useCreateAttestation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().create(token(), payload),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['attestations'] });
        toast.success('Attestation émise');
      } else toast.error(String(res.error));
    },
  });
}

export function useUpdateAttestation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().update(token(), id, payload),
    onSuccess: (res, { id }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['attestations'] });
        qc.invalidateQueries({ queryKey: ['attestation', id] });
        toast.success('Attestation mise à jour');
      } else toast.error(String(res.error));
    },
  });
}

export function useAttestationsTypeStats(filters: object = {}) {
  // Clé préfixée par 'attestations' afin que les invalidations existantes
  // (create/update/delete) rafraîchissent aussi les stats.
  return useQuery({
    queryKey: ['attestations', 'type-stats', filters],
    queryFn: () => ipc().typeStats(token(), filters),
  });
}

export function useDeleteAttestation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().delete(token(), id),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['attestations'] });
        toast.success('Attestation supprimée');
      } else toast.error(String(res.error));
    },
  });
}
