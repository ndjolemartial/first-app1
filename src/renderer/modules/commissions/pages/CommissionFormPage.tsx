import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Select from '../../../shared/components/ui/Select';
import { FormSearchSelect } from '../../../shared/components/ui/SearchSelect';
import Input from '../../../shared/components/ui/Input';
import Textarea from '../../../shared/components/ui/Textarea';
import {
  useCreateCommission,
  useEligibleConventions,
  useCommissionUsers,
  useReferrers,
  useCommissionSettings,
} from '../hooks/useCommissions';
import { clientName, referrerName, TRANSACTION_TYPE_LABEL } from '../utils/commissions.utils';
import { formatCurrency } from '../../../shared/utils/format';
import { Save } from 'lucide-react';

/** Détermine le type de transaction naturel d'une convention. */
function conventionKind(type: string): 'VENTE' | 'LOCATION' | 'SOUSCRIPTION' {
  if (type === 'SALE') return 'VENTE';
  if (type === 'SOUSCRIPTION') return 'SOUSCRIPTION';
  return 'LOCATION';
}

const schema = z.object({
  conventionId: z.string().min(1, 'Sélectionnez une convention'),
  beneficiaryType: z.enum(['USER', 'REFERRER']),
  userId: z.string().optional(),
  referrerId: z.string().optional(),
  transactionType: z.enum(['VENTE', 'LOCATION', 'SOUSCRIPTION', 'FRAIS_DOSSIER']),
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

  const { data: conventionsRes, isLoading: conventionsLoading } = useEligibleConventions();
  const { data: usersRes } = useCommissionUsers();
  const { data: referrersRes } = useReferrers({ isActive: true }, 1, 200);
  const { data: settingsRes } = useCommissionSettings();

  const conventions: any[] = conventionsRes?.data ?? [];
  const users: any[] = usersRes?.data ?? [];
  const referrers: any[] = referrersRes?.data ?? [];
  const settings = settingsRes?.data ?? { saleRate: 0, rentalRate: 0, dossierRate: 0 };

  const {
    register, handleSubmit, watch, setValue, control, formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      conventionId: searchParams.get('conventionId') ?? '',
      beneficiaryType: 'USER',
      userId: '',
      referrerId: '',
      transactionType: 'VENTE',
      baseAmount: '',
      rate: '',
      notes: '',
    },
  });

  const conventionId = watch('conventionId');
  const beneficiaryType = watch('beneficiaryType');
  const transactionType = watch('transactionType');
  const baseAmount = Number(watch('baseAmount') || 0);
  const rate = Number(watch('rate') || 0);

  const selectedConvention = conventions.find((c) => c.id === Number(conventionId));
  const naturalKind = selectedConvention ? conventionKind(selectedConvention.type) : null;
  const computedAmount = Math.round(baseAmount * (rate / 100) * 100) / 100;

  /** Pré-remplit l'assiette et le taux selon la convention et le type de commission. */
  function applyDefaults(id: number, type: string) {
    const c = conventions.find((x) => x.id === id);
    if (!c) return;
    if (type === 'VENTE' || type === 'SOUSCRIPTION') {
      // Vente et souscription : assiette = prix de vente, taux de vente par défaut
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

  // Pré-remplissage si une convention est passée en paramètre d'URL
  useEffect(() => {
    if (conventionId && conventions.length > 0) {
      const c = conventions.find((x) => x.id === Number(conventionId));
      if (c) {
        const kind = conventionKind(c.type);
        setValue('transactionType', kind);
        applyDefaults(Number(conventionId), kind);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conventions.length]);

  const apiError = create.data && !create.data.success ? create.data.error : null;

  const onSubmit = async (data: FormData) => {
    const payload: Record<string, unknown> = {
      conventionId: Number(data.conventionId),
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

  const conventionOptions = conventions.map((c) => ({
    value: String(c.id),
    label: `${c.reference} — ${clientName(c.client)} (${TRANSACTION_TYPE_LABEL[conventionKind(c.type)]})`,
  }));

  // Le type proposé est celui de la convention (vente/location/souscription) + les frais de dossier
  const typeOptions = [
    ...((!naturalKind || naturalKind === 'VENTE') ? [{ value: 'VENTE', label: 'Vente' }] : []),
    ...((!naturalKind || naturalKind === 'LOCATION') ? [{ value: 'LOCATION', label: 'Location' }] : []),
    ...((!naturalKind || naturalKind === 'SOUSCRIPTION') ? [{ value: 'SOUSCRIPTION', label: 'Souscription' }] : []),
    { value: 'FRAIS_DOSSIER', label: 'Frais d\'ouverture de dossier' },
  ];

  const baseLabel = transactionType === 'FRAIS_DOSSIER'
    ? 'Montant des frais d\'ouverture de dossier'
    : transactionType === 'LOCATION'
      ? 'Assiette (un mois de loyer)'
      : transactionType === 'SOUSCRIPTION'
        ? 'Assiette (montant de la souscription)'
        : 'Assiette (prix de vente)';

  return (
    <PageLayout
      title="Nouvelle commission"
      breadcrumbs={[{ label: 'Commissions', to: '/commissions' }, { label: 'Nouvelle commission' }]}
    >
      <div className="max-w-2xl mx-auto">
        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

            {/* Convention */}
            <div>
              <FormSearchSelect
                control={control}
                name="conventionId"
                label="Convention (vente, location ou souscription)"
                required
                placeholder={conventionsLoading ? 'Chargement…' : 'Sélectionnez une convention'}
                options={conventionOptions}
                error={errors.conventionId?.message}
                onValueChange={(v) => {
                  const c = conventions.find((x) => x.id === Number(v));
                  if (!c) return;
                  const kind = conventionKind(c.type);
                  setValue('transactionType', kind);
                  applyDefaults(c.id, kind);
                }}
              />
              {selectedConvention && (
                <p className="mt-1 text-xs text-slate-500">
                  {TRANSACTION_TYPE_LABEL[conventionKind(selectedConvention.type)]} ·
                  {' '}Bien {selectedConvention.property?.reference ?? '—'} ·
                  {' '}Client {clientName(selectedConvention.client)}
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
                  onChange: (e) => applyDefaults(Number(conventionId), e.target.value),
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
