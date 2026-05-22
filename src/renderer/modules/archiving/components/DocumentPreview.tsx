import { useEffect, useState } from 'react';
import { FileQuestion } from 'lucide-react';
import { useAuthStore } from '../../../shared/stores/auth.store';

interface DocumentPreviewProps {
  documentId: number;
  mimeType: string;
  name: string;
}

type PreviewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'unavailable' }
  | { status: 'ready'; url: string };

/**
 * Aperçu intégré d'un document : images, PDF, audio et vidéo.
 * Les fichiers volumineux ou non prévisualisables affichent un message.
 */
export default function DocumentPreview({ documentId, mimeType, name }: DocumentPreviewProps) {
  const token = useAuthStore((s) => s.token)!;
  const [state, setState] = useState<PreviewState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    window.electron.documents.getFileData(token, documentId).then((r: any) => {
      if (cancelled) return;
      if (!r.success) { setState({ status: 'error', message: String(r.error) }); return; }
      if (r.data?.tooLarge || !r.data?.base64) { setState({ status: 'unavailable' }); return; }
      setState({ status: 'ready', url: `data:${r.data.mimeType};base64,${r.data.base64}` });
    });
    return () => { cancelled = true; };
  }, [documentId, token]);

  if (state.status === 'loading') {
    return <div className="flex h-80 items-center justify-center text-sm text-slate-400">Chargement de l'aperçu…</div>;
  }
  if (state.status === 'error') {
    return <div className="flex h-40 items-center justify-center text-sm text-red-500">{state.message}</div>;
  }
  if (state.status === 'unavailable') {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-500">
        <FileQuestion className="h-8 w-8 text-slate-300" />
        <p className="text-sm">Aperçu indisponible — fichier volumineux. Utilisez « Ouvrir ».</p>
      </div>
    );
  }

  if (mimeType.startsWith('image/')) {
    return <img src={state.url} alt={name} className="mx-auto max-h-[70vh] rounded-lg" />;
  }
  if (mimeType === 'application/pdf') {
    return <iframe src={state.url} title={name} className="h-[70vh] w-full rounded-lg border border-slate-200" />;
  }
  if (mimeType.startsWith('video/')) {
    return <video src={state.url} controls className="mx-auto max-h-[70vh] w-full rounded-lg" />;
  }
  if (mimeType.startsWith('audio/')) {
    return (
      <div className="flex h-40 items-center justify-center">
        <audio src={state.url} controls className="w-full max-w-md" />
      </div>
    );
  }
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-500">
      <FileQuestion className="h-8 w-8 text-slate-300" />
      <p className="text-sm">Aperçu non disponible pour ce format. Utilisez « Ouvrir ».</p>
    </div>
  );
}
