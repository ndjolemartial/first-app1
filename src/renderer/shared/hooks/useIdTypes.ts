import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/auth.store';
import { toast } from '../components/ui/Toast';

/** Type de pièce d'identité issu du catalogue paramétrable. */
export interface IdDocumentType {
  id: number;
  code: string;
  label: string;
  isDefault: boolean;
  isActive: boolean;
}

const ipc = () => window.electron.settings;
const token = () => useAuthStore.getState().token!;

/**
 * Récupère la liste des types de pièces d'identité. Par défaut, n'affiche
 * que les types actifs (utile pour les sélecteurs de formulaire). Passer
 * `true` pour inclure les types désactivés (gestion en Paramètres).
 */
export function useIdTypes(includeInactive = false) {
  return useQuery({
    queryKey: ['idTypes', includeInactive],
    queryFn: () => ipc().listIdTypes(token(), includeInactive),
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  return (res: any) => {
    if (res.success) qc.invalidateQueries({ queryKey: ['idTypes'] });
    else toast.error(String(res.error));
  };
}

export function useCreateIdType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().createIdType(token(), payload),
    onSuccess: invalidate(qc),
  });
}

export function useUpdateIdType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) =>
      ipc().updateIdType(token(), id, payload),
    onSuccess: invalidate(qc),
  });
}

export function useDeleteIdType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().deleteIdType(token(), id),
    onSuccess: invalidate(qc),
  });
}
