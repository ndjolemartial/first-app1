import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.permitLibrary;
const token = () => useAuthStore.getState().token!;

function useInvalidate(keys: string[]) {
  const qc = useQueryClient();
  return () => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

/* ─── Communes ────────────────────────────────────────────────────────── */
export function usePermitCommunes(includeInactive = false) {
  return useQuery({ queryKey: ['permit-communes', includeInactive], queryFn: () => ipc().communes.list(token(), includeInactive) });
}
export function useSavePermitCommune() {
  const invalidate = useInvalidate(['permit-communes']);
  return useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: object }) => ipc().communes.upsert(token(), id, payload),
    onSuccess: (res) => { if (res.success) { invalidate(); toast.success('Commune enregistrée'); } else toast.error(String(res.error)); },
  });
}
export function useDeletePermitCommune() {
  const invalidate = useInvalidate(['permit-communes']);
  return useMutation({
    mutationFn: (id: number) => ipc().communes.delete(token(), id),
    onSuccess: (res) => { if (res.success) { invalidate(); toast.success('Commune supprimée'); } else toast.error(String(res.error)); },
  });
}

/* ─── Catalogue de prestations/frais/taxes ───────────────────────────── */
export function usePermitFeeItems(filters: object = {}) {
  return useQuery({ queryKey: ['permit-fee-items', filters], queryFn: () => ipc().feeItems.list(token(), filters) });
}
export function usePermitFeeItem(id: number) {
  return useQuery({ queryKey: ['permit-fee-item', id], queryFn: () => ipc().feeItems.getById(token(), id), enabled: id > 0 });
}
export function useSavePermitFeeItem() {
  const invalidate = useInvalidate(['permit-fee-items']);
  return useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: object }) =>
      (id ? ipc().feeItems.update(token(), id, payload) : ipc().feeItems.create(token(), payload)),
    onSuccess: (res) => { if (res.success) { invalidate(); toast.success('Prestation enregistrée'); } else toast.error(String(res.error)); },
  });
}
export function useDeletePermitFeeItem() {
  const invalidate = useInvalidate(['permit-fee-items']);
  return useMutation({
    mutationFn: (id: number) => ipc().feeItems.delete(token(), id),
    onSuccess: (res) => { if (res.success) { invalidate(); toast.success('Prestation supprimée'); } else toast.error(String(res.error)); },
  });
}

/* ─── Surcharges de taux ──────────────────────────────────────────────── */
export function usePermitRateOverrides(feeItemId: number) {
  return useQuery({ queryKey: ['permit-rate-overrides', feeItemId], queryFn: () => ipc().rateOverrides.list(token(), feeItemId), enabled: feeItemId > 0 });
}
export function useSavePermitRateOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: any }) => ipc().rateOverrides.upsert(token(), id, payload),
    onSuccess: (res, { payload }: any) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['permit-rate-overrides', payload.feeItemId] });
        toast.success('Surcharge enregistrée');
      } else toast.error(String(res.error));
    },
  });
}
export function useDeletePermitRateOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().rateOverrides.delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['permit-rate-overrides'] }); toast.success('Surcharge supprimée'); }
      else toast.error(String(res.error));
    },
  });
}

/* ─── Tranches de surface (BAREME_SURFACE) ───────────────────────────── */
export function usePermitSurfaceBrackets(feeItemId: number) {
  return useQuery({ queryKey: ['permit-surface-brackets', feeItemId], queryFn: () => ipc().surfaceBrackets.list(token(), feeItemId), enabled: feeItemId > 0 });
}
export function useSavePermitSurfaceBracket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: number; payload: any }) => ipc().surfaceBrackets.upsert(token(), id, payload),
    onSuccess: (res, { payload }: any) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['permit-surface-brackets', payload.feeItemId] });
        toast.success('Tranche enregistrée');
      } else toast.error(String(res.error));
    },
  });
}
export function useDeletePermitSurfaceBracket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().surfaceBrackets.delete(token(), id),
    onSuccess: (res) => {
      if (res.success) { qc.invalidateQueries({ queryKey: ['permit-surface-brackets'] }); toast.success('Tranche supprimée'); }
      else toast.error(String(res.error));
    },
  });
}
