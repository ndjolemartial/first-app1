import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Save } from 'lucide-react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Textarea from '../../../shared/components/ui/Textarea';
import { useBudget, useCreateBudget, useUpdateBudget } from '../hooks/useBudget';

interface FormData {
  name: string;
  description: string;
  periodStart: string;
  periodEnd: string;
  totalAllocated: string;
  notes: string;
}

const toDateInput = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');

export default function BudgetFormPage() {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const idNum = params.id ? Number(params.id) : 0;
  const isEdit = idNum > 0;

  const create = useCreateBudget();
  const update = useUpdateBudget();
  const { data: existing } = useBudget(idNum);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      name: '',
      description: '',
      periodStart: '',
      periodEnd: '',
      totalAllocated: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (existing?.success && existing.data) {
      const b = existing.data;
      reset({
        name: b.name ?? '',
        description: b.description ?? '',
        periodStart: toDateInput(b.periodStart),
        periodEnd: toDateInput(b.periodEnd),
        totalAllocated: b.totalAllocated != null ? String(b.totalAllocated) : '',
        notes: b.notes ?? '',
      });
    }
  }, [existing, reset]);

  const closed = existing?.success && existing.data?.status === 'CLOTURE';
  const apiError =
    (create.data && !create.data.success && create.data.error) ||
    (update.data && !update.data.success && update.data.error) ||
    null;

  const onSubmit = async (data: FormData) => {
    const payload = {
      name: data.name.trim(),
      description: data.description.trim() || undefined,
      periodStart: new Date(`${data.periodStart}T00:00:00`).toISOString(),
      periodEnd: new Date(`${data.periodEnd}T23:59:59`).toISOString(),
      totalAllocated: data.totalAllocated ? Number(data.totalAllocated) : undefined,
      notes: data.notes.trim() || undefined,
    };
    const r = isEdit
      ? await update.mutateAsync({ id: idNum, payload })
      : await create.mutateAsync(payload);
    if (r.success) navigate(isEdit ? `/budgets/${idNum}` : `/budgets/${r.data.id}`);
  };

  return (
    <PageLayout
      title={isEdit ? 'Modifier le budget' : 'Nouveau budget'}
      breadcrumbs={[
        { label: 'Budgets', to: '/budgets' },
        { label: isEdit ? 'Modifier' : 'Nouveau' },
      ]}
    >
      <div className="max-w-2xl mx-auto">
        <Card>
          {closed && (
            <p className="mb-4 text-sm text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Ce budget est clôturé. Réouvrez-le depuis sa fiche avant toute modification.
            </p>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <Input
                label="Nom du budget"
                required
                placeholder="Ex : Budget exploitation 2026"
                error={errors.name && 'Nom requis'}
                disabled={closed}
                {...register('name', { required: true })}
              />
              <Textarea
                label="Description"
                rows={3}
                placeholder="Objet du budget, périmètre, etc."
                disabled={closed}
                {...register('description')}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Date de début"
                  type="date"
                  required
                  error={errors.periodStart && 'Date de début requise'}
                  disabled={closed}
                  {...register('periodStart', { required: true })}
                />
                <Input
                  label="Date de fin"
                  type="date"
                  required
                  error={errors.periodEnd && 'Date de fin requise'}
                  disabled={closed}
                  {...register('periodEnd', { required: true })}
                />
              </div>
              <Input
                label="Total alloué (optionnel)"
                type="number"
                step="0.01"
                helper="Somme indicative — la somme effective des lignes est calculée automatiquement."
                disabled={closed}
                {...register('totalAllocated')}
              />
              <Textarea label="Notes" rows={2} disabled={closed} {...register('notes')} />
            </div>

            {apiError && (
              <p className="text-sm text-red-600">
                {typeof apiError === 'string' ? apiError : 'Erreur lors de l\'enregistrement'}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => navigate(-1)}>Annuler</Button>
              <Button type="submit" loading={isSubmitting} disabled={closed} icon={<Save className="h-4 w-4" />}>
                {isEdit ? 'Enregistrer' : 'Créer le budget'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </PageLayout>
  );
}
