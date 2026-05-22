import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Textarea from '../../../shared/components/ui/Textarea';
import { useTreasuryAccounts, useTreasuryCategories, useCreateTreasuryOperation } from '../hooks/useTreasury';
import { useAccessibleBudgetLines } from '../../budget/hooks/useBudget';
import { DIRECTION_OPTIONS, PAYMENT_METHOD_OPTIONS, categoryLabel } from '../utils/treasury.utils';
import { formatCurrency } from '../../../shared/utils/format';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { Save } from 'lucide-react';

interface FormData {
  bankAccountId: string;
  direction: string;
  amount: string;
  operationDate: string;
  categoryId: string;
  label: string;
  paymentMethod: string;
  paymentRef: string;
  budgetLineId: string;
  notes: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function OperationFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetAccount = searchParams.get('accountId') ?? '';
  const presetDirection = searchParams.get('direction') ?? '';

  const create = useCreateTreasuryOperation();
  const { data: accountsRes } = useTreasuryAccounts({ isActive: 'true' });
  const accounts = accountsRes?.data ?? [];
  const currentUser = useAuthStore((s) => s.user);

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      bankAccountId: presetAccount,
      direction: presetDirection || 'SORTIE',
      amount: '',
      operationDate: today(),
      categoryId: '',
      label: '',
      paymentMethod: 'ESPECE',
      paymentRef: '',
      budgetLineId: '',
      notes: '',
    },
  });

  // Pré-sélectionne le compte rattaché à l'utilisateur connecté, si présent
  // dans la liste des comptes accessibles et qu'aucun compte n'a été imposé via l'URL.
  useEffect(() => {
    if (presetAccount) return;
    if (!currentUser || accounts.length === 0) return;
    const linked = accounts.find((a: any) => a.linkedUserId === currentUser.id);
    if (linked) setValue('bankAccountId', String(linked.id));
  }, [presetAccount, currentUser, accounts, setValue]);

  const direction = watch('direction');
  const { data: categoriesRes } = useTreasuryCategories({ direction, isActive: 'true' });
  const categories = categoriesRes?.data ?? [];
  // Lignes budgétaires utilisables par l'utilisateur courant pour une sortie.
  const { data: budgetLinesRes } = useAccessibleBudgetLines();
  const budgetLines = budgetLinesRes?.data ?? [];

  // Le compte de destination est obligatoire : redirige si aucun n'existe.
  useEffect(() => {
    if (accountsRes && accounts.length === 0) {
      // Aucun compte actif : on laisse l'utilisateur en créer un.
    }
  }, [accountsRes, accounts.length]);

  const apiError = create.data && !create.data.success ? create.data.error : null;

  const onSubmit = async (data: FormData) => {
    const payload = {
      bankAccountId: Number(data.bankAccountId),
      direction: data.direction,
      amount: Number(data.amount),
      operationDate: new Date(`${data.operationDate}T12:00:00`).toISOString(),
      categoryId: data.categoryId ? Number(data.categoryId) : undefined,
      label: data.label || undefined,
      paymentMethod: data.paymentMethod || undefined,
      paymentRef: data.paymentRef || undefined,
      // Imputation budgétaire : valide uniquement pour les sorties.
      budgetLineId:
        data.direction === 'SORTIE' && data.budgetLineId ? Number(data.budgetLineId) : undefined,
      notes: data.notes || undefined,
    };
    const r = await create.mutateAsync(payload);
    if (r.success) navigate(`/treasury/accounts/${payload.bankAccountId}`);
  };

  const accountOptions = accounts.map((a: any) => ({ value: String(a.id), label: a.name }));
  const categoryOptions = categories.map((c: any) => ({ value: String(c.id), label: categoryLabel(c) }));

  return (
    <PageLayout
      title="Nouvelle opération de trésorerie"
      breadcrumbs={[{ label: 'Trésorerie', to: '/treasury' }, { label: 'Nouvelle opération' }]}
    >
      <div className="max-w-2xl mx-auto">
        <Card>
          {accounts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-slate-500 mb-4">
                Aucun compte de trésorerie actif. Créez d'abord un compte pour enregistrer des opérations.
              </p>
              <Button onClick={() => navigate('/treasury/accounts/new')}>Créer un compte</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700">Opération</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Compte"
                    required
                    options={accountOptions}
                    placeholder="Choisir un compte"
                    error={errors.bankAccountId && 'Compte requis'}
                    {...register('bankAccountId', { required: true })}
                  />
                  <Select label="Sens" required options={DIRECTION_OPTIONS} {...register('direction')} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Montant"
                    type="number"
                    step="0.01"
                    required
                    error={errors.amount && 'Montant requis'}
                    {...register('amount', { required: true, validate: (v) => Number(v) > 0 })}
                  />
                  <Input label="Date de l'opération" type="date" {...register('operationDate')} />
                </div>
                <div>
                  <Select
                    label="Objet d'opération (compte comptable)"
                    required
                    options={categoryOptions}
                    placeholder="Choisir un objet"
                    error={errors.categoryId && 'Objet requis'}
                    {...register('categoryId', { required: true })}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Nature de l'opération rattachée à un numéro de compte comptable.
                  </p>
                </div>
                <Input
                  label="Libellé"
                  placeholder="Ex : Encaissement loyer mai, Achat fournitures…"
                  {...register('label')}
                />
              </div>

              {direction === 'SORTIE' && (
                <div className="border-t border-slate-200 pt-4 space-y-2">
                  <h3 className="text-sm font-semibold text-slate-700">Imputation budgétaire</h3>
                  <Select
                    label="Ligne budgétaire (optionnel)"
                    options={[
                      { value: '', label: '— Aucune imputation budgétaire —' },
                      ...budgetLines.map((l: any) => ({
                        value: String(l.id),
                        label: `${l.budget?.reference ?? ''} · ${l.label} — solde ${formatCurrency(l.remaining)}`,
                      })),
                    ]}
                    {...register('budgetLineId')}
                  />
                  <p className="text-xs text-slate-500">
                    Seules les lignes actives des budgets ouverts dont vous êtes gestionnaire (ou
                    administrateur) apparaissent ici.
                  </p>
                </div>
              )}

              <div className="border-t border-slate-200 pt-4 space-y-4">
                <h3 className="text-sm font-semibold text-slate-700">Règlement</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Select label="Mode de règlement" options={PAYMENT_METHOD_OPTIONS} {...register('paymentMethod')} />
                  <Input label="Référence (chèque, virement…)" {...register('paymentRef')} />
                </div>
                <Textarea label="Notes" rows={3} {...register('notes')} />
              </div>

              {apiError && (
                <p className="text-sm text-red-600">
                  {typeof apiError === 'string' ? apiError : 'Erreur lors de l\'enregistrement'}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" type="button" onClick={() => navigate('/treasury')}>
                  Annuler
                </Button>
                <Button type="submit" loading={isSubmitting} icon={<Save className="h-4 w-4" />}>
                  Enregistrer l'opération
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </PageLayout>
  );
}
