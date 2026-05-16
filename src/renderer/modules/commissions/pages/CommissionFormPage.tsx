import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Select from '../../../shared/components/ui/Select';
import Input from '../../../shared/components/ui/Input';
import Textarea from '../../../shared/components/ui/Textarea';
import {
  useCreateCommission,
  useEligibleContracts,
  useCommissionUsers,
  useReferrers,
  useCommissionSettings,
} from '../hooks/useCommissions';
import { clientName, referrerName, TRANSACTION_TYPE_LABEL } from '../utils/commissions.utils';
import { formatCurrency } from '../../../shared/utils/format';
import { Save } from 'lucide-react';

/** Détermine le type de transaction naturel d'un contrat. */
function contractKind(type: string): 'VENTE' | 'LOCATION' {
  return type === 'SALE' ? 'VENTE' : 'LOCATION';
}

const schema = z.object({
  contractId: z.string().min(1, 'Sélectionnez un contrat'),
  beneficiaryType: z.enum(['USER', 'REFERRER']),
  userId: z.string().optional(),
  referrerId: z.string().optional(),
  transactionType: z.enum(['VENTE', 'LOCATION', 'FRAIS_DOSSIER']),
  baseAmount: z.string().refine((v) => Number(v) > 0, 'Le montant de l\'assiette doit être positif'),
  rate: z.string().refine((v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 100;
  }, 'Taux compris entre 0 et 100 %'),
  notes: z.string().optional(),
}).refine(
  (d) => (d.beneficiaryType === 'USER' ? !!d.userId : !!d.referrerId),
  { message: 'Sélectionnez un bénéficiaire', path: ['beneficiaryType'] },
);

type FormData = z.infer<typeof schema>;

export default function CommissionFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const create = useCreateCommission();

  const { data: contractsRes, isLoading: contractsLoading } = useEligibleContracts();
  const { data: usersRes } = useCommissionUsers();
  const { data: referrersRes } = useReferrers({ isActive: true }, 1, 200);
  const { data: settingsRes } = useCommissionSettings();

  const contracts: any[] = contractsRes?.data ?? [];
  const users: any[] = usersRes?.data ?? [];
  const referrers: any[] = referrersRes?.data ?? [];
  const settings = settingsRes?.data ?? { saleRate: 0, rentalRate: 0, dossierRate: 0 };

  const {
    register, handleSubmit, watch, setValue, formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      contractId: searchParams.get('contractId') ?? '',
      beneficiaryType: 'USER',
      userId: '',
      referrerId: '',
      transactionType: 'VENTE',
      baseAmount: '',
      rate: '',
      notes: '',
    },
  });

  const contractId = watch('contractId');
  const beneficiaryType = watch('beneficiaryType');
  const transactionType = watch('transactionType');
  const baseAmount = Number(watch('baseAmount') || 0);
  const rate = Number(watch('rate') || 0);

  const selectedContract = contracts.find((c) => c.id === Number(contractId));
  const naturalKind = selectedContract ? contractKind(selectedContract.type) : null;
  const computedAmount = Math.round(baseAmount * (rate / 100) * 100) / 100;

  /** Pré-remplit l'assiette et le taux selon le contrat et le type de commission. */
  function applyDefaults(id: number, type: string) {
    const c = contracts.find((x) => x.id === id);
    if (!c) return;
    if (type === 'VENTE') {
      const v = Number(c.saleAmount ?? 0);
      setValue('baseAmount', v > 0 ? String(v) : '');
      setValue('rate', String(settings.saleRate));
    } else if (type === 'LOCATION') {
      const v = Number(c.rentAmount ?? 0);
      setValue('baseAmount', v > 0 ? String(v) : '');
      setValue('rate', String(settings.rentalRate));
    } else {
      // FRAIS_DOSSIER : assiette saisie manuellement, taux dédié par défaut
      setValue('baseAmount', '');
      setValue('rate', String(settings.dossierRate));
    }
  }

  // Pré-remplissage si un contrat est passé en paramètre d'URL
  useEffect(() => {
    if (contractId && contracts.length > 0) {
      const c = contracts.find((x) => x.id === Number(contractId));
      if (c) {
        const kind = contractKind(c.type);
        setValue('transactionType', kind);
        applyDefaults(Number(contractId), kind);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contracts.length]);

  const apiError = create.data && !create.data.success ? create.data.error : null;

  const onSubmit = async (data: FormData) => {
    const payload: Record<string, unknown> = {
      contractId: Number(data.contractId),
      beneficiaryType: data.beneficiaryType,
      transactionType: data.transactionType,
      baseAmount: Number(data.baseAmount),
      rate: Number(data.rate),
      notes: data.notes || undefined,
    };
    if (data.beneficiaryType === 'USER') payload.userId = Number(data.userId);
    else payload.referrerId = Number(data.referrerId);

    const r = await create.mutateAsync(payload);
    if (r.success) navigate('/commissions/all');
  };

  const contractOptions = contracts.map((c) => ({
    value: String(c.id),
    label: `${c.reference} — ${clientName(c.client)} (${TRANSACTION_TYPE_LABEL[contractKind(c.type)]})`,
  }));

  // Le type proposé est celui du contrat (vente/location) + les frais de dossier
  const typeOptions = [
    ...((!naturalKind || naturalKind === 'VENTE') ? [{ value: 'VENTE', label: 'Vente' }] : []),
    ...((!naturalKind || naturalKind === 'LOCATION') ? [{ value: 'LOCATION', label: 'Location' }] : []),
    { value: 'FRAIS_DOSSIER', label: 'Frais d\'ouverture de dossier' },
  ];

  const baseLabel = transactionType === 'FRAIS_DOSSIER'
    ? 'Montant des frais d\'ouverture de dossier'
    : transactionType === 'LOCATION'
      ? 'Assiette (un mois de loyer)'
      : 'Assiette (prix de vente)';

  return (
    <PageLayout
      title="Nouvelle commission"
      breadcrumbs={[{ label: 'Commissions', to: '/commissions' }, { label: 'Nouvelle commission' }]}
    >
      <div className="max-w-2xl mx-auto">
        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

            {/* Contrat */}
            <div>
              <Select
                label="Contrat (vente ou location)"
                required
                placeholder={contractsLoading ? 'Chargement…' : 'Sélectionnez un contrat'}
                options={contractOptions}
                error={errors.contractId?.message}
                {...register('contractId', {
                  onChange: (e) => {
                    const c = contracts.find((x) => x.id === Number(e.target.value));
                    if (!c) return;
                    const kind = contractKind(c.type);
                    setValue('transactionType', kind);
                    applyDefaults(c.id, kind);
                  },
                })}
              />
              {selectedContract && (
                <p className="mt-1 text-xs text-slate-500">
                  {TRANSACTION_TYPE_LABEL[contractKind(selectedContract.type)]} ·
                  {' '}Bien {selectedContract.property?.reference ?? '—'} ·
                  {' '}Client {clientName(selectedContract.client)}
                </p>
              )}
            </div>

            {/* Bénéficiaire */}
            <div className="border-t border-slate-200 pt-4 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">Bénéficiaire de la commission</h3>
              <Select
                label="Type de bénéficiaire"
                options={[
                  { value: 'USER', label: 'Utilisateur (agent, manager…)' },
                  { value: 'REFERRER', label: 'Apporteur d\'affaire' },
                ]}
                error={errors.beneficiaryType?.message}
                {...register('beneficiaryType')}
              />
              {beneficiaryType === 'USER' ? (
                <Select
                  label="Utilisateur"
                  required
                  placeholder="Sélectionnez un utilisateur"
                  options={users.map((u) => ({
                    value: String(u.id),
                    label: `${u.firstName} ${u.lastName} — ${u.role}`,
                  }))}
                  {...register('userId')}
                />
              ) : (
                <div>
                  <Select
                    label="Apporteur d'affaire"
                    required
                    placeholder="Sélectionnez un apporteur"
                    options={referrers.map((r) => ({ value: String(r.id), label: referrerName(r) }))}
                    {...register('referrerId')}
                  />
                  {referrers.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600">
                      Aucun apporteur d'affaire.{' '}
                      <button type="button" className="underline" onClick={() => navigate('/commissions/referrers/new')}>
                        Créer un apporteur
                      </button>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Calcul de la commission */}
            <div className="border-t border-slate-200 pt-4 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">Calcul de la commission</h3>
              <Select
                label="Type de commission"
                options={typeOptions}
                {...register('transactionType', {
                  onChange: (e) => applyDefaults(Number(contractId), e.target.value),
                })}
              />
              {transactionType === 'FRAIS_DOSSIER' && (
                <p className="text-xs text-slate-500 -mt-2">
                  Commission appliquée sur les frais d'ouverture de dossier — saisissez le montant des frais ci-dessous.
                </p>
              )}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label={baseLabel}
                  type="number"
                  step="0.01"
                  required
                  error={errors.baseAmount?.message}
                  {...register('baseAmount')}
                />
                <Input
                  label="Taux de commission (%)"
                  type="number"
                  step="0.01"
                  required
                  error={errors.rate?.message}
                  {...register('rate')}
                />
              </div>
              <div className="bg-blue-50 rounded-lg p-4 flex items-center justify-between">
                <span className="text-sm text-slate-600">Montant de la commission</span>
                <span className="text-2xl font-bold text-slate-900">{formatCurrency(computedAmount)}</span>
              </div>
            </div>

            <Textarea label="Notes (optionnel)" rows={3} {...register('notes')} />

            {apiError && (
              <p className="text-sm text-red-600">
                {typeof apiError === 'string' ? apiError : 'Erreur lors de la création de la commission'}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => navigate('/commissions')}>Annuler</Button>
              <Button type="submit" loading={isSubmitting} icon={<Save className="h-4 w-4" />}>
                Créer la commission
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </PageLayout>
  );
}
