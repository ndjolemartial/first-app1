import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import { Save } from 'lucide-react';
import { useExpense, useExpenseCategories, useCreateExpense, useUpdateExpense } from '../hooks/useExpenses';

interface FormData {
  label: string;
  categoryId: string;
  amount: number | string;
  dueDate: string;
  notes: string;
}

const EMPTY: FormData = { label: '', categoryId: '', amount: '', dueDate: '', notes: '' };

function toDateInput(d?: string | Date | null): string {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export default function ExpenseFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const expenseId = Number(id);

  const { data: catRes } = useExpenseCategories();
  const { data: res } = useExpense(isEdit ? expenseId : 0);
  const create = useCreateExpense();
  const update = useUpdateExpense();

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormData>({ defaultValues: EMPTY });

  useEffect(() => {
    if (isEdit && res?.success && res.data) {
      const e = res.data;
      reset({
        label: e.label ?? '',
        categoryId: e.categoryId != null ? String(e.categoryId) : '',
        amount: e.amount != null ? Number(e.amount) : '',
        dueDate: toDateInput(e.dueDate),
        notes: e.notes ?? '',
      });
    }
  }, [res, isEdit, reset]);

  const categories: any[] = catRes?.success ? (catRes.data ?? []) : [];
  const categoryOptions = [
    { value: '', label: '— Objet de sortie —' },
    ...categories.map((c) => ({ value: String(c.id), label: c.label })),
  ];

  const onSubmit = async (d: FormData) => {
    const payload = {
      label: d.label.trim(),
      categoryId: Number(d.categoryId),
      amount: Number(d.amount) || 0,
      dueDate: d.dueDate,
      notes: d.notes?.trim() || null,
    };
    if (isEdit) {
      const r = await update.mutateAsync({ id: expenseId, payload });
      if (r.success) navigate('/expenses');
    } else {
      const r = await create.mutateAsync(payload);
      if (r.success) navigate('/expenses');
    }
  };

  return (
    <PageLayout
      title={isEdit ? 'Modifier la charge prévisionnelle' : 'Nouvelle charge prévisionnelle'}
      breadcrumbs={[{ label: 'Charges prévisionnelles', to: '/expenses' }, { label: isEdit ? 'Modifier' : 'Nouvelle' }]}
    >
      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-4">
          <Input label="Libellé" placeholder="Ex: Loyer du bureau — mars 2026" {...register('label', { required: true })} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Objet (sortie)" options={categoryOptions} {...register('categoryId', { required: true })} />
            <Input label="Montant prévisionnel (FCFA)" type="number" step="any" min="1" {...register('amount', { required: true })} />
            <Input label="Date prévue de règlement" type="date" {...register('dueDate', { required: true })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
            <textarea rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" {...register('notes')} />
          </div>
          <p className="text-xs text-slate-500">
            Un rappel est automatiquement créé dans le CRM à la date prévue. Les objets proviennent des objets de
            sortie de la comptabilité.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => navigate('/expenses')}>Annuler</Button>
            <Button type="submit" loading={isSubmitting || create.isPending || update.isPending} icon={<Save className="h-4 w-4" />}>
              Enregistrer
            </Button>
          </div>
        </form>
      </Card>
    </PageLayout>
  );
}
