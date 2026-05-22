import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { toast } from '../../../shared/components/ui/Toast';

/** Hooks de la GED (gestion électronique de documents). */

const ipc = () => window.electron.documents;
const token = () => useAuthStore.getState().token!;

export function useGedDocuments(filters: object = {}, page = 1, limit = 24) {
  return useQuery({
    queryKey: ['ged-documents', filters, page],
    queryFn: () => ipc().list(token(), filters, page, limit),
  });
}

export function useGedDocument(id: number) {
  return useQuery({
    queryKey: ['ged-document', id],
    queryFn: () => ipc().getById(token(), id),
    enabled: id > 0,
  });
}

export function useGedCategories() {
  return useQuery({ queryKey: ['ged-categories'], queryFn: () => ipc().listCategories(token()) });
}

export function useGedFolders() {
  return useQuery({ queryKey: ['ged-folders'], queryFn: () => ipc().listFolders(token()) });
}

export function useGedTags() {
  return useQuery({ queryKey: ['ged-tags'], queryFn: () => ipc().listTags(token()) });
}

export function useGedDashboard() {
  return useQuery({ queryKey: ['ged-dashboard'], queryFn: () => ipc().gedDashboard(token()) });
}

export function useGedAudit(limit = 100) {
  return useQuery({ queryKey: ['ged-audit', limit], queryFn: () => ipc().listAudit(token(), limit) });
}

export function useImportDocuments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().import(token(), payload),
    onSuccess: (res: any) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['ged-documents'] });
        qc.invalidateQueries({ queryKey: ['ged-dashboard'] });
        toast.success(`${res.data?.length ?? 0} document(s) archivé(s)`);
      } else toast.error(String(res.error));
    },
  });
}

export function useUpdateGedDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().update(token(), id, payload),
    onSuccess: (res: any, { id }) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['ged-documents'] });
        qc.invalidateQueries({ queryKey: ['ged-document', id] });
        toast.success('Document mis à jour');
      } else toast.error(String(res.error));
    },
  });
}

export function useDeleteGedDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().remove(token(), id),
    onSuccess: (res: any) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['ged-documents'] });
        qc.invalidateQueries({ queryKey: ['ged-dashboard'] });
        toast.success('Document mis à la corbeille');
      } else toast.error(String(res.error));
    },
  });
}

function invalidator(qc: ReturnType<typeof useQueryClient>, key: string) {
  return (res: any) => {
    if (res.success) qc.invalidateQueries({ queryKey: [key] });
    else toast.error(String(res.error));
  };
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().createCategory(token(), payload),
    onSuccess: invalidator(qc, 'ged-categories'),
  });
}
export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().updateCategory(token(), id, payload),
    onSuccess: invalidator(qc, 'ged-categories'),
  });
}
export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().deleteCategory(token(), id),
    onSuccess: invalidator(qc, 'ged-categories'),
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().createFolder(token(), payload),
    onSuccess: invalidator(qc, 'ged-folders'),
  });
}
export function useUpdateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().updateFolder(token(), id, payload),
    onSuccess: invalidator(qc, 'ged-folders'),
  });
}
export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().deleteFolder(token(), id),
    onSuccess: invalidator(qc, 'ged-folders'),
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: object) => ipc().createTag(token(), payload),
    onSuccess: invalidator(qc, 'ged-tags'),
  });
}
export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => ipc().updateTag(token(), id, payload),
    onSuccess: invalidator(qc, 'ged-tags'),
  });
}
export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ipc().deleteTag(token(), id),
    onSuccess: (res: any) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['ged-tags'] });
        qc.invalidateQueries({ queryKey: ['ged-documents'] });
      } else toast.error(String(res.error));
    },
  });
}

/** Ouvre un document dans l'application externe du système. */
export async function openDocumentExternally(id: number): Promise<void> {
  const r = await ipc().open(token(), id);
  if (!r.success) toast.error(typeof r.error === 'string' ? r.error : "Impossible d'ouvrir le fichier");
}
