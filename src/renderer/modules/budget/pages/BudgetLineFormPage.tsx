import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Save } from 'lucide-react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Textarea from '../../../shared/components/ui/Textarea';
import {
  useBudget, useBudgetLine, useCreateBudgetLine, useUpdateBudgetLine, useEligibleManagers,
} from '../hooks/useBudget';

interface FormData {
  code: string;
  label: string;
  description: string;
  allocatedAmount: string;
  managerId: string;
  isActive: 'true' | 'false';
  notes: string;
}

export default function BudgetLineFormPage() {
  const navigate = useNavigate();
  const params = useParams<{ id: string; lineId?: string }>();
  const budgetId = Number(params.id);
  const lineId = params.lineId ? Number(params.lineId) : 0;
  const isEdit = lineId > 0;

  const { data: budgetRes } = useBudget(budgetId);
  const { data: lineRes } = useBudgetLine(lineId);
  const { data: managersRes } = useEligibleManagers();
  const create = useCreateBudgetLine();
  const update = useUpdateBudgetLine();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      code: '',
      label: '',
      description: '',
      allocatedAmount: '',
      managerId: '',
      isActive: 'true',
      notes: '',
    },
  });

  useEffect(() => {
    if (lineRes?.success && lineRes.data) {
      const l = lineRes.data;
      reset({
        code: l.code ?? '',
        label: l.label,
        description: l.description ?? '',
        allocatedAmount: String(l.allocatedAmount ?? ''),
        managerId: l.managerId ? String(l.managerId) : '',
        isActive: l.isActive ? 'true' : 'false',
        notes: l.notes ?? '',
      });
    }
  }, [lineRes, reset]);

  const budgetClosed = budgetRes?.success && budgetRes.data?.status === 'CLOTURE';
  const managers = managersRes?.data ?? [];
  const managerOptions = [
    { value: '', label: '— Aucun gestionnaire —' },
    ...managers.map((u: any) => ({
      value: String(u.id),
      label: `${u.firstName} ${u.lastName} (${u.role})`,
    })),
  ];

  const apiError =
    (create.data && !create.data.success && create.data.error) ||
    (update.data && !update.data.success && update.data.error) ||
    null;

  const onSubmit = async (data: FormData) => {
    const payload = {
      budgetId,
      code: data.code.trim() || undefined,
      label: data.label.trim(),
      description: data.description.trim() || undefined,
      allocatedAmount: Number(data.allocatedAmount),
      managerId: data.managerId ? Number(data.managerId) : null,
      isActive: data.isActive === 'true',
      notes: data.notes.trim() || undefined,
    };
    const r = isEdit
      ? await update.mutateAsync({ id: lineId, payload })
      : await create.mutateAsync(payload);
    if (r.success) navigate(`/budgets/${budgetId}`);
  };

  return (
    <PageLayout
      title={isEdit ? 'Modifier la ligne' : 'Nouvelle ligne budgétaire'}
      breadcrumbs={[
        { label: 'Budgets', to: '/budgets' },
        { label: budgetRes?.data?.name ?? '—', to: `/budgets/${budgetId}` },
        { label: isEdit ? 'Modifier' : 'Nouvelle ligne' },
      ]}
    >
      <div className="max-w-2xl mx-auto">
        <Card>
          {budgetClosed && (
            <p className="mb-4 text-sm text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Le budget parent est clôturé. Aucune modification possible.
            </p>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <Input label="Code" placeholder="BL-001" disabled={budgetClosed} {...register('code')} />
              <div className="col-span-2">
                <Input
                  label="Libellé"
                  required
                  placeholder="Ex : Loyers bureaux"
                  error={errors.label && 'Libellé requis'}
                  disabled={budgetClosed}
                  {...register('label', { required: true })}
                />
              </div>
            </div>
            <Textarea label="Description" rows={2} disabled={budgetClosed} {...register('description')} />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Montant alloué"
                type="number"
                step="0.01"
                required
                error={errors.allocatedAmount && 'Montant requis'}
                disabled={budgetClosed}
                {...register('allocatedAmount', { required: true, validate: (v) => Number(v) >= 0 })}
              />
              <Select
                label="Statut"
                disabled={budgetClosed}
                options={[
                  { value: 'true', label: 'Active' },
                  { value: 'false', label: 'Inactive' },
                ]}
                {...register('isActive')}
              />
            </div>
            <div>
              <Select
                label="Gestionnaire (utilisateur)"
                disabled={budgetClosed}
                options={managerOptions}
                {...register('managerId')}
              />
              <p className="text-xs text-slate-500 mt-1">
                Seul cet utilisateur (ou un administrateur) pourra imputer des sorties à cette ligne.
                Les administrateurs et super-administrateurs ne peuvent pas être désignés gestionnaire.
              </p>
            </div>
            <Textarea label="Notes" rows={2} disabled={budgetClosed} {...register('notes')} />

            {apiError && (
              <p className="text-sm text-red-600">
                {typeof apiError === 'string' ? apiError : 'Erreur lors de l\'enregistrement'}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => navigate(`/budgets/${budgetId}`)}>
                Annuler
              </Button>
              <Button type="submit" loading={isSubmitting} disabled={budgetClosed} icon={<Save className="h-4 w-4" />}>
                {isEdit ? 'Enregistrer' : 'Créer la ligne'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </PageLayout>
  );
}
