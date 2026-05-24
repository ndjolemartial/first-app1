import { useEffect, useState } from 'react';
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
import { Save, Briefcase, Map, Building } from 'lucide-react';
import { clsx } from 'clsx';

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
  imputationKind: 'NONE' | 'PROJECT' | 'LOTISSEMENT' | 'PROGRAMME';
  projectId: string;
  lotissementId: string;
  programmeId: string;
  notes: string;
}

type SelectOption = { value: string; label: string };

/** Charge une liste IPC au montage et la mappe en options { value, label }. */
function useEntityOptions(
  loader: () => Promise<{ success?: boolean; data?: any[] }>,
  labelOf: (item: any) => string,
): SelectOption[] {
  const [options, setOptions] = useState<SelectOption[]>([]);
  useEffect(() => {
    loader().then((r) => {
      const list: any[] = r?.success ? (r.data as any[]) ?? [] : [];
      setOptions(list.map((i) => ({ value: String(i.id), label: labelOf(i) })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return options;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function OperationFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetAccount = searchParams.get('accountId') ?? '';
  const presetDirection = searchParams.get('direction') ?? '';
  // Pré-remplissage de l'imputation analytique depuis la page d'origine
  // (ex : /treasury/operations/new?projectId=12).
  const presetProjectId     = searchParams.get('projectId') ?? '';
  const presetLotissementId = searchParams.get('lotissementId') ?? '';
  const presetProgrammeId   = searchParams.get('programmeId') ?? '';
  const presetImputation: FormData['imputationKind'] =
    presetProjectId ? 'PROJECT'
    : presetLotissementId ? 'LOTISSEMENT'
    : presetProgrammeId ? 'PROGRAMME'
    : 'NONE';

  const create = useCreateTreasuryOperation();
  const { data: accountsRes } = useTreasuryAccounts({ isActive: 'true' });
  const accounts = accountsRes?.data ?? [];
  const currentUser = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token)!;

  // Listes pour les selects d'imputation analytique (chargées une fois).
  const projectOptions = useEntityOptions(
    () => window.electron.projects.list(token, {}, 1, 500),
    (p) => `${p.reference} · ${p.nom}`,
  );
  const lotissementOptions = useEntityOptions(
    () => window.electron.lotissements.list(token, {}, 1, 500),
    (l) => `${l.reference} · ${l.nom}`,
  );
  const programmeOptions = useEntityOptions(
    () => window.electron.programmes.list(token, {}, 1, 500),
    (p) => `${p.reference} · ${p.nom}`,
  );

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
      imputationKind: presetImputation,
      projectId: presetProjectId,
      lotissementId: presetLotissementId,
      programmeId: presetProgrammeId,
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
    // Imputation analytique : on n'envoie qu'UN seul des trois IDs selon le type choisi.
    const projectId     = data.imputationKind === 'PROJECT'     && data.projectId     ? Number(data.projectId)     : null;
    const lotissementId = data.imputationKind === 'LOTISSEMENT' && data.lotissementId ? Number(data.lotissementId) : null;
    const programmeId   = data.imputationKind === 'PROGRAMME'   && data.programmeId   ? Number(data.programmeId)   : null;
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
      projectId,
      lotissementId,
      programmeId,
      notes: data.notes || undefined,
    };
    const r = await create.mutateAsync(payload);
    if (r.success) navigate(`/treasury/accounts/${payload.bankAccountId}`);
  };

  const imputationKind = watch('imputationKind');

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

              {/* ─── Imputation analytique : Projet / Lotissement / Programme ─── */}
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Imputation analytique</h3>
                  <p className="text-xs text-slate-500">
                    Rattachez cette opération à un projet, un lotissement ou un programme immobilier
                    pour pouvoir tracer le flux de trésorerie associé.
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: 'NONE',        label: 'Aucune',      icon: null },
                    { value: 'PROJECT',     label: 'Projet',      icon: <Briefcase className="h-4 w-4" /> },
                    { value: 'LOTISSEMENT', label: 'Lotissement', icon: <Map className="h-4 w-4" /> },
                    { value: 'PROGRAMME',   label: 'Programme',   icon: <Building className="h-4 w-4" /> },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={clsx(
                        'flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors',
                        imputationKind === opt.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300',
                      )}
                    >
                      <input
                        type="radio"
                        value={opt.value}
                        className="sr-only"
                        {...register('imputationKind')}
                      />
                      {opt.icon}
                      {opt.label}
                    </label>
                  ))}
                </div>
                {imputationKind === 'PROJECT' && (
                  <Select
                    label="Projet"
                    options={[{ value: '', label: '— Choisir un projet —' }, ...projectOptions]}
                    {...register('projectId')}
                  />
                )}
                {imputationKind === 'LOTISSEMENT' && (
                  <Select
                    label="Lotissement"
                    options={[{ value: '', label: '— Choisir un lotissement —' }, ...lotissementOptions]}
                    {...register('lotissementId')}
                  />
                )}
                {imputationKind === 'PROGRAMME' && (
                  <Select
                    label="Programme immobilier"
                    options={[{ value: '', label: '— Choisir un programme —' }, ...programmeOptions]}
                    {...register('programmeId')}
                  />
                )}
              </div>

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
