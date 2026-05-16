import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';

const ipc = () => window.electron.contracts;
const token = () => useAuthStore.getState().token!;

export function useContracts(filters: object = {}, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['contracts', filters, page],
    queryFn: () => ipc().list(token(), filters, page, limit),
  });
}

export function useContract(id: number) {
  return useQuery({
    queryKey: ['contract', id],
    queryFn: () => ipc().getById(token(), id),
    enabled: id > 0,
  });
}

export function useCreateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().create(token(), payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts'] }),
  });
}

export function useUpdateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) =>
      ipc().update(token(), id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['contracts'] });
      qc.invalidateQueries({ queryKey: ['contract', id] });
    },
  });
}

export function useDeleteContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().delete(token(), id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts'] }),
  });
}

export function useGenerateInstallments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().generateInstallments(token(), id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['contract', id] });
      qc.invalidateQueries({ queryKey: ['installments', id] });
    },
  });
}

export function useInstallments(contractId: number) {
  return useQuery({
    queryKey: ['installments', contractId],
    queryFn: () => ipc().getInstallments(token(), contractId),
    enabled: contractId > 0,
  });
}
