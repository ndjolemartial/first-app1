import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/auth.store';
import { toast } from '../components/ui/Toast';

/** Nature de titre administratif de lotissement (catalogue paramétrable). */
export interface LotissementTitleType {
  id: number;
  code: string;
  label: string;
  /** Documents livrés avec les terrains de ce titre (texte libre). */
  documentsLivres?: string | null;
  isDefault: boolean;
  isActive: boolean;
}

const ipc = () => window.electron.settings;
const token = () => useAuthStore.getState().token!;

/**
 * Récupère la liste des natures de titres sollicités pour un lotissement.
 * Par défaut n'inclut que les entrées actives (utile pour les selects).
 */
export function useTitleTypes(includeInactive = false) {
  return useQuery({
    queryKey: ['titleTypes', includeInactive],
    queryFn: () => ipc().listTitleTypes(token(), includeInactive),
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  return (res: any) => {
    if (res.success) qc.invalidateQueries({ queryKey: ['titleTypes'] });
    else toast.error(String(res.error));
  };
}

export function useCreateTitleType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().createTitleType(token(), payload),
    onSuccess: invalidate(qc),
  });
}

export function useUpdateTitleType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) =>
      ipc().updateTitleType(token(), id, payload),
    onSuccess: invalidate(qc),
  });
}

export function useDeleteTitleType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().deleteTitleType(token(), id),
    onSuccess: invalidate(qc),
  });
}
