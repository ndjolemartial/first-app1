import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.expenses;
const token = () => useAuthStore.getState().token!;

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['expenses'] });
  qc.invalidateQueries({ queryKey: ['crm-activities'] });
  qc.invalidateQueries({ queryKey: ['treasury'] });
}

export function useExpenses(filters: object = {}, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['expenses', 'list', filters, page],
    queryFn: () => ipc().list(token(), filters, page, limit),
  });
}

export function useExpense(id: number) {
  return useQuery({
    queryKey: ['expenses', 'detail', id],
    queryFn: () => ipc().getById(token(), id),
    enabled: id > 0,
  });
}

export function useExpenseStats() {
  return useQuery({
    queryKey: ['expenses', 'stats'],
    queryFn: () => ipc().stats(token()),
  });
}

export function useExpenseCategories() {
  return useQuery({
    queryKey: ['expenses', 'categories'],
    queryFn: () => ipc().listCategories(token()),
    staleTime: 5 * 60 * 1000,
  });
}

export function useExpenseAccounts() {
  return useQuery({
    queryKey: ['expenses', 'accounts'],
    queryFn: () => ipc().listAccounts(token()),
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().create(token(), payload),
    onSuccess: (res) => {
      if (res.success) { invalidate(qc); toast.success('Charge prévisionnelle créée'); }
      else toast.error(String(res.error));
    },
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().update(token(), id, payload),
    onSuccess: (res) => {
      if (res.success) { invalidate(qc); toast.success('Charge modifiée'); }
      else toast.error(String(res.error));
    },
  });
}

export function useSettleExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().settle(token(), payload),
    onSuccess: (res) => {
      if (res.success) { invalidate(qc); toast.success('Charge réglée et enregistrée en comptabilité'); }
      else toast.error(String(res.error));
    },
  });
}

export function useCancelExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().cancel(token(), id),
    onSuccess: (res) => {
      if (res.success) { invalidate(qc); toast.success('Charge annulée'); }
      else toast.error(String(res.error));
    },
  });
}

export function useRemoveExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().remove(token(), id),
    onSuccess: (res) => {
      if (res.success) { invalidate(qc); toast.success('Charge supprimée'); }
      else toast.error(String(res.error));
    },
  });
}
