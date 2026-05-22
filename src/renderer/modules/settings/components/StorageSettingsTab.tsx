import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Save } from 'lucide-react';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import { useStorageSettings, useUpdateStorage } from '../hooks/useSettings';

interface FormData {
  path: string;
  maxFileSizeMb: number;
}

export default function StorageSettingsTab() {
  const { data: res, isLoading } = useStorageSettings();
  const update = useUpdateStorage();

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: { path: '', maxFileSizeMb: 10 },
  });

  useEffect(() => {
    if (res?.success && res.data) {
      reset({
        path:          res.data.path ?? '',
        maxFileSizeMb: res.data.maxFileSizeMb ?? 10,
      });
    }
  }, [res, reset]);

  const onSubmit = handleSubmit((data) => update.mutate({
    path:          data.path?.trim() || undefined,
    maxFileSizeMb: Number(data.maxFileSizeMb) || undefined,
  }));

  if (isLoading) return <Card>Chargement…</Card>;
  const resolved = res?.success ? res.data?.resolvedPath : null;

  return (
    <Card>
      <h3 className="font-semibold text-slate-700 mb-4">Stockage des fichiers</h3>
      <p className="text-sm text-slate-500 mb-4">
        Dossier racine où sont écrits les documents importés, les logos et les médias du slideshow.
        L'application crée des sous-dossiers (<code>ged/</code>, <code>logo/</code>, <code>slideshow/</code>) au besoin.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Chemin du dossier de stockage"
          placeholder="ex : F:\\Afrikimmo\\storage  (laisser vide pour utiliser ./data/storage)"
          {...register('path')}
        />
        {resolved && (
          <p className="text-xs text-slate-500 -mt-2">
            Chemin actuellement utilisé : <span className="font-mono text-slate-700">{resolved}</span>
          </p>
        )}
        <Input
          label="Taille maximale par fichier (Mo)"
          type="number"
          min="1"
          {...register('maxFileSizeMb', { valueAsNumber: true })}
        />
        <div className="flex justify-end pt-2">
          <Button type="submit" loading={isSubmitting || update.isPending} icon={<Save className="h-4 w-4" />}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Card>
  );
}
