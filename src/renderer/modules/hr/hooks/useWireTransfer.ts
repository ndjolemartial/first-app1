import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

const ipc = () => window.electron.wireTransfer;
const token = () => useAuthStore.getState().token!;

/** Modèle éditable de l'ordre de virement (Paramètres → Modèles d'imprimés). */
export function useWireTransferTemplate() {
  return useQuery({
    queryKey: ['wire-transfer-template'],
    queryFn: () => ipc().getTemplate(token()),
  });
}

export function useUpdateWireTransferTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().updateTemplate(token(), id, payload),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['wire-transfer-template'] });
        toast.success('Modèle enregistré');
      } else {
        toast.error(typeof res.error === 'string' ? res.error : "Erreur lors de l'enregistrement");
      }
    },
    onError: () => toast.error('Erreur réseau'),
  });
}

/** Aperçu / impression de l'ordre de virement du mois sélectionné. */
export function usePrintWireTransferOrder() {
  return useMutation({
    mutationFn: ({ periodYear, periodMonth }: { periodYear: number; periodMonth: number }) =>
      ipc().print(token(), periodYear, periodMonth),
    onSuccess: (res) => {
      if (!res.success) toast.error(typeof res.error === 'string' ? res.error : 'Erreur lors de la génération');
    },
    onError: () => toast.error('Erreur réseau'),
  });
}

export function useExportWireTransferOrderPdf() {
  return useMutation({
    mutationFn: ({ periodYear, periodMonth }: { periodYear: number; periodMonth: number }) =>
      ipc().exportPdf(token(), periodYear, periodMonth),
    onSuccess: (res) => {
      if (!res.success) toast.error(typeof res.error === 'string' ? res.error : "Erreur lors de l'export");
      else if (!res.data?.canceled) toast.success('Export PDF enregistré');
    },
    onError: () => toast.error('Erreur réseau'),
  });
}

export function useExportWireTransferOrderExcel() {
  return useMutation({
    mutationFn: ({ periodYear, periodMonth }: { periodYear: number; periodMonth: number }) =>
      ipc().exportExcel(token(), periodYear, periodMonth),
    onSuccess: (res) => {
      if (!res.success) toast.error(typeof res.error === 'string' ? res.error : "Erreur lors de l'export");
      else if (!res.data?.canceled) toast.success('Export Excel enregistré');
    },
    onError: () => toast.error('Erreur réseau'),
  });
}
