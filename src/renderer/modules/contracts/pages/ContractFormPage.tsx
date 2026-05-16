import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Textarea from '../../../shared/components/ui/Textarea';
import Card from '../../../shared/components/ui/Card';
import { useContract, useCreateContract, useUpdateContract } from '../hooks/useContracts';
import { useClients } from '../../clients/hooks/useClients';
import { useProperties } from '../../properties/hooks/useProperties';
import { useTerrains } from '../../terrains/hooks/useTerrains';
import { Save } from 'lucide-react';

/** Identifiant optionnel : une chaîne vide est traitée comme « non renseigné ». */
const optionalId = z.preprocess(
  (v) => (v === '' || v === undefined || v === null ? undefined : Number(v)),
  z.number().int().positive().optional(),
);

const schema = z.object({
  assetType: z.enum(['PROPERTY', 'TERRAIN']).default('TERRAIN'),
  propertyId: optionalId,
  terrainId: optionalId,
  clientId: z.coerce.number().int().positive('Client requis'),
  type: z.enum(['RENTAL_UNFURNISHED', 'RENTAL_FURNISHED', 'SALE', 'MANAGEMENT', 'COMMERCIAL_LEASE']),
  status: z.enum(['BROUILLON', 'ACTIVE', 'EXPIRE', 'TERMINER', 'ANNULE', 'ATTENTE_SIGNATURE']).default('BROUILLON'),
  startDate: z.string().min(1, 'Date de début requise'),
  endDate: z.string().optional(),
  signedAt: z.string().optional(),
  rentAmount: z.coerce.number().optional(),
  saleAmount: z.coerce.number().optional(),
  deposit: z.coerce.number().optional(),
  agencyFees: z.coerce.number().optional(),
  charges: z.coerce.number().optional(),
  paymentDay: z.coerce.number().int().min(1).max(31).optional(),
  paymentMethod: z.enum(['ESPECE', 'CHEQUE', 'TRANSFERT', 'VIREMENT', 'MOBILE_MONEY']).default('ESPECE'),
  paymentModalites: z.enum(['CASH', 'SUR_3_MOIS', 'SUR_6_MOIS', 'SUR_9_MOIS', 'SUR_12_MOIS', 'SUR_24_MOIS', 'SUR_36_MOIS', 'SUR_48_MOIS', 'SUR_60_MOIS', 'SUR_PLUS_60_MOIS']).default('CASH'),
  installmentCount: z.coerce.number().int().optional(),
  firstInstallmentDate: z.string().optional(),
  notes: z.string().optional(),
}).superRefine((d, ctx) => {
  if (d.assetType === 'PROPERTY' && !d.propertyId) {
    ctx.addIssue({ code: 'custom', path: ['propertyId'], message: 'Bien immobilier requis' });
  }
  if (d.assetType === 'TERRAIN' && !d.terrainId) {
    ctx.addIssue({ code: 'custom', path: ['terrainId'], message: 'Terrain requis' });
  }
});

type FormData = z.infer<typeof schema>;

const ASSET_TYPE_OPTIONS = [
  { value: 'PROPERTY', label: 'Un bien immobilier' },
  { value: 'TERRAIN', label: 'Un terrain' },
];

const TYPE_OPTIONS = [
  { value: 'RENTAL_UNFURNISHED', label: 'Location non meublée' },
  { value: 'RENTAL_FURNISHED', label: 'Location meublée' },
  { value: 'SALE', label: 'Vente' },
  { value: 'MANAGEMENT', label: 'Gestion' },
  { value: 'COMMERCIAL_LEASE', label: 'Bail commercial' },
];

const STATUS_OPTIONS = [
  { value: 'BROUILLON', label: 'Brouillon' },
  { value: 'ATTENTE_SIGNATURE', label: 'Attente signature' },
  { value: 'ACTIVE', label: 'Actif' },
  { value: 'EXPIRE', label: 'Expiré' },
  { value: 'TERMINER', label: 'Terminé' },
  { value: 'ANNULE', label: 'Annulé' },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: 'ESPECE', label: 'Espèces' },
  { value: 'CHEQUE', label: 'Chèque' },
  { value: 'TRANSFERT', label: 'Transfert' },
  { value: 'VIREMENT', label: 'Virement bancaire' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
];

const PAYMENT_MODALITES_OPTIONS = [
  { value: 'CASH', label: 'Paiement comptant' },
  { value: 'SUR_3_MOIS', label: '3 mois' },
  { value: 'SUR_6_MOIS', label: '6 mois' },
  { value: 'SUR_9_MOIS', label: '9 mois' },
  { value: 'SUR_12_MOIS', label: '12 mois' },
  { value: 'SUR_24_MOIS', label: '24 mois' },
  { value: 'SUR_36_MOIS', label: '36 mois' },
  { value: 'SUR_48_MOIS', label: '48 mois' },
  { value: 'SUR_60_MOIS', label: '60 mois' },
  { value: 'SUR_PLUS_60_MOIS', label: '+ de 60 mois (libre)' },
];

function toDateInput(val?: string | Date | null): string {
  if (!val) return '';
  const d = new Date(val);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export default function ContractFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { data: res } = useContract(isEdit ? Number(id) : 0);
  const create = useCreateContract();
  const update = useUpdateContract();
  const { data: clientsRes } = useClients({}, 1, 500);
  const { data: propertiesRes } = useProperties({}, 1, 500);
  const { data: terrainsRes } = useTerrains({}, 1, 500);
  const [isSale, setIsSale] = useState(false);
  const [isInstallment, setIsInstallment] = useState(false);

  const clientOptions = [
    { value: '', label: '— Choisir un client —' },
    ...(clientsRes?.data ?? []).map((c: any) => ({
      value: String(c.id),
      label: c.type === 'INDIVIDUEL'
        ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()
        : (c.entreprise ?? ''),
    })),
  ];

  const propertyOptions = [
    { value: '', label: '— Choisir un bien —' },
    ...(propertiesRes?.data ?? []).map((p: any) => ({
      value: String(p.id),
      label: `${p.reference} — ${p.address}, ${p.city}`,
    })),
  ];

  const terrainOptions = [
    { value: '', label: '— Choisir un terrain —' },
    ...(terrainsRes?.data ?? []).map((t: any) => ({
      value: String(t.id),
      label: `${t.reference} — ${t.lotissement?.nom ?? ''}`.trim()
        + (t.numeroParcelle ? ` (Parcelle ${t.numeroParcelle})` : ''),
    })),
  ];

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<z.input<typeof schema>, any, FormData>({
    resolver: zodResolver(schema),
    defaultValues: { assetType: 'TERRAIN', type: 'RENTAL_UNFURNISHED', status: 'BROUILLON', paymentMethod: 'ESPECE', paymentModalites: 'CASH' },
  });

  const watchType = watch('type');
  const watchModalites = watch('paymentModalites');
  const watchAssetType = watch('assetType');

  useEffect(() => {
    setIsSale(watchType === 'SALE');
  }, [watchType]);

  useEffect(() => {
    setIsInstallment(watchModalites !== 'CASH');
  }, [watchModalites]);

  useEffect(() => {
    if (isEdit && res?.data) {
      const c = res.data;
      reset({
        ...c,
        assetType: c.assetType ?? 'PROPERTY',
        propertyId: c.propertyId ?? undefined,
        terrainId: c.terrainId ?? undefined,
        clientId: c.clientId,
        startDate: toDateInput(c.startDate),
        endDate: toDateInput(c.endDate),
        signedAt: toDateInput(c.signedAt),
        firstInstallmentDate: toDateInput(c.firstInstallmentDate),
        rentAmount: c.rentAmount ? Number(c.rentAmount) : undefined,
        saleAmount: c.saleAmount ? Number(c.saleAmount) : undefined,
        deposit: c.deposit ? Number(c.deposit) : undefined,
        agencyFees: c.agencyFees ? Number(c.agencyFees) : undefined,
        charges: c.charges ? Number(c.charges) : undefined,
      });
    }
  }, [res, isEdit, reset]);

  const onSubmit = async (data: FormData) => {
    const payload: any = { ...data };
    // N'envoie que l'élément rattaché correspondant au type choisi
    if (payload.assetType === 'TERRAIN') delete payload.propertyId;
    else delete payload.terrainId;
    // Convertit les dates en ISO datetime
    if (payload.startDate) payload.startDate = new Date(payload.startDate).toISOString();
    if (payload.endDate) payload.endDate = new Date(payload.endDate).toISOString();
    else delete payload.endDate;
    if (payload.signedAt) payload.signedAt = new Date(payload.signedAt).toISOString();
    else delete payload.signedAt;
    if (payload.firstInstallmentDate) payload.firstInstallmentDate = new Date(payload.firstInstallmentDate).toISOString();
    else delete payload.firstInstallmentDate;

    let r;
    if (isEdit) r = await update.mutateAsync({ id: Number(id), payload });
    else r = await create.mutateAsync(payload);
    if (r.success) navigate(`/contracts/${r.data?.id ?? ''}`);
  };

  return (
    <PageLayout
      title={isEdit ? 'Modifier le contrat' : 'Nouveau contrat'}
      breadcrumbs={[{ label: 'Contrats', to: '/contracts' }, { label: isEdit ? 'Modifier' : 'Nouveau' }]}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-3xl mx-auto">
        {/* Rattachement */}
        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Rattachement du contrat</h3>
          <div className="space-y-4">
            <Select label="Le contrat porte sur *" options={ASSET_TYPE_OPTIONS} {...register('assetType')} />
            {watchAssetType === 'TERRAIN' ? (
              <Select label="Terrain *" options={terrainOptions} error={errors.terrainId?.message} {...register('terrainId')} />
            ) : (
              <Select label="Bien immobilier *" options={propertyOptions} error={errors.propertyId?.message} {...register('propertyId')} />
            )}
            <Select label="Client *" options={clientOptions} error={errors.clientId?.message} {...register('clientId')} />
          </div>
        </Card>

        {/* Type et statut */}
        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Type de contrat</h3>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Type *" options={TYPE_OPTIONS} error={errors.type?.message} {...register('type')} />
            <Select label="Statut" options={STATUS_OPTIONS} {...register('status')} />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Input label="Date de début *" type="date" error={errors.startDate?.message} {...register('startDate')} />
            <Input label="Date de fin" type="date" {...register('endDate')} />
          </div>
          <div className="mt-4">
            <Input label="Date de signature" type="date" {...register('signedAt')} />
          </div>
        </Card>

        {/* Conditions financières */}
        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Conditions financières</h3>
          {!isSale ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Loyer mensuel (FCFA)" type="number" step="1000" {...register('rentAmount')} />
                <Input label="Charges (FCFA)" type="number" step="1000" {...register('charges')} />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <Input label="Caution / Dépôt (FCFA)" type="number" step="1000" {...register('deposit')} />
                <Input label="Honoraires agence (FCFA)" type="number" step="1000" {...register('agencyFees')} />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <Input label="Jour de paiement (1-31)" type="number" min="1" max="31" {...register('paymentDay')} />
                <Select label="Mode de paiement" options={PAYMENT_METHOD_OPTIONS} {...register('paymentMethod')} />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Prix de vente (FCFA)" type="number" step="1000" {...register('saleAmount')} />
                <Input label="Honoraires agence (FCFA)" type="number" step="1000" {...register('agencyFees')} />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <Select label="Modalités de paiement" options={PAYMENT_MODALITES_OPTIONS} {...register('paymentModalites')} />
                <Select label="Mode de paiement" options={PAYMENT_METHOD_OPTIONS} {...register('paymentMethod')} />
              </div>
              {isInstallment && (
                <div className="grid grid-cols-2 gap-4 mt-4 p-4 bg-blue-50 rounded-lg">
                  <div>
                    <Input label="Nombre d'échéances (si > 60 mois)" type="number" {...register('installmentCount')} />
                    <p className="text-xs text-slate-500 mt-1">Laissez vide pour utiliser le nombre calculé depuis les modalités.</p>
                  </div>
                  <Input label="Date 1ère échéance" type="date" {...register('firstInstallmentDate')} />
                </div>
              )}
              <div className="mt-4">
                <Input label="Caution (FCFA)" type="number" step="1000" {...register('deposit')} />
              </div>
            </>
          )}
        </Card>

        {/* Notes */}
        <Card>
          <h3 className="text-base font-semibold text-slate-800 mb-4">Notes</h3>
          <Textarea label="Observations" rows={3} {...register('notes')} />
        </Card>

        <div className="flex justify-end gap-3 pb-8">
          <Button variant="secondary" type="button" onClick={() => navigate('/contracts')}>Annuler</Button>
          <Button type="submit" loading={isSubmitting} icon={<Save className="h-4 w-4" />}>
            {isEdit ? 'Enregistrer' : 'Créer le contrat'}
          </Button>
        </div>
      </form>
    </PageLayout>
  );
}
