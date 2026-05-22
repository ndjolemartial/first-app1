import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Textarea from '../../../shared/components/ui/Textarea';
import {
  useTreasuryAccount, useCreateTreasuryAccount, useUpdateTreasuryAccount, useTreasuryUsers,
} from '../hooks/useTreasury';
import { ACCOUNT_TYPE_OPTIONS } from '../utils/treasury.utils';
import { Save } from 'lucide-react';

const schema = z.object({
  name: z.string().min(1, 'Libellé requis'),
  type: z.enum(['BANQUE', 'CAISSE', 'MOBILE_MONEY']),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  iban: z.string().optional(),
  bic: z.string().optional(),
  currency: z.string().optional(),
  initialBalance: z.string().optional(),
  isActive: z.string().optional(),
  notes: z.string().optional(),
  linkedUserId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function AccountFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();

  const { data: res } = useTreasuryAccount(isEdit ? Number(id) : 0);
  const create = useCreateTreasuryAccount();
  const update = useUpdateTreasuryAccount();
  const { data: usersRes } = useTreasuryUsers();

  const userOptions = [
    { value: '', label: '— Aucun (compte commun à tous) —' },
    ...(usersRes?.data ?? []).map((u: any) => ({
      value: String(u.id),
      label: `${u.firstName} ${u.lastName} (${u.role})`,
    })),
  ];

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'BANQUE', currency: 'XOF', initialBalance: '0', isActive: 'true', linkedUserId: '' },
  });

  useEffect(() => {
    if (isEdit && res?.data) {
      reset({
        name: res.data.name ?? '',
        type: res.data.type ?? 'BANQUE',
        bankName: res.data.bankName ?? '',
        accountNumber: res.data.accountNumber ?? '',
        iban: res.data.iban ?? '',
        bic: res.data.bic ?? '',
        currency: res.data.currency ?? 'XOF',
        initialBalance: String(res.data.initialBalance ?? 0),
        isActive: String(res.data.isActive),
        notes: res.data.notes ?? '',
        linkedUserId: res.data.linkedUserId ? String(res.data.linkedUserId) : '',
      });
    }
  }, [res, isEdit, reset]);

  const apiError = create.data && !create.data.success ? create.data.error
    : update.data && !update.data.success ? update.data.error
    : null;

  const onSubmit = async (data: FormData) => {
    const payload = {
      name: data.name,
      type: data.type,
      bankName: data.bankName,
      accountNumber: data.accountNumber,
      iban: data.iban,
      bic: data.bic,
      currency: data.currency || 'XOF',
      initialBalance: data.initialBalance ? Number(data.initialBalance) : 0,
      isActive: data.isActive !== 'false',
      notes: data.notes,
      linkedUserId: data.linkedUserId ? Number(data.linkedUserId) : null,
    };
    const r = isEdit
      ? await update.mutateAsync({ id: Number(id), payload })
      : await create.mutateAsync(payload);
    if (r.success) navigate(isEdit ? `/treasury/accounts/${id}` : '/treasury');
  };

  return (
    <PageLayout
      title={isEdit ? 'Modifier le compte' : 'Nouveau compte de trésorerie'}
      breadcrumbs={[
        { label: 'Trésorerie', to: '/treasury' },
        { label: isEdit ? 'Modifier le compte' : 'Nouveau compte' },
      ]}
    >
      <div className="max-w-2xl mx-auto">
        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

            {/* Identification */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">Identification du compte</h3>
              <Input
                label="Libellé du compte"
                required
                placeholder="Ex : Compte courant SGBCI"
                error={errors.name?.message}
                {...register('name')}
              />
              <div className="grid grid-cols-2 gap-4">
                <Select label="Type de compte" required options={ACCOUNT_TYPE_OPTIONS} {...register('type')} />
                <Input label="Devise" placeholder="XOF" {...register('currency')} />
              </div>
            </div>

            {/* Coordonnées bancaires */}
            <div className="border-t border-slate-200 pt-4 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">Coordonnées bancaires</h3>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Banque / Opérateur" {...register('bankName')} />
                <Input label="Numéro de compte / RIB" {...register('accountNumber')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="IBAN" {...register('iban')} />
                <Input label="BIC / SWIFT" {...register('bic')} />
              </div>
            </div>

            {/* Solde & statut */}
            <div className="border-t border-slate-200 pt-4 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">Solde d'ouverture</h3>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Solde initial"
                  type="number"
                  step="0.01"
                  helper="Solde du compte avant la saisie des opérations."
                  {...register('initialBalance')}
                />
                <Select
                  label="Statut"
                  options={[{ value: 'true', label: 'Actif' }, { value: 'false', label: 'Inactif' }]}
                  {...register('isActive')}
                />
              </div>
              <Textarea label="Notes" rows={3} {...register('notes')} />
            </div>

            {/* Accès et confidentialité */}
            <div className="border-t border-slate-200 pt-4 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">Accès au compte</h3>
              <Select
                label="Compte rattaché à un utilisateur"
                options={userOptions}
                {...register('linkedUserId')}
              />
              <p className="text-xs text-slate-500">
                Si un utilisateur est sélectionné, le compte devient privé : hormis les rôles
                SUPER ADMIN et ADMIN, seul cet utilisateur pourra consulter le compte et y
                enregistrer des opérations (entrées comme sorties). Laisser vide pour un compte
                commun, accessible à tous.
              </p>
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
                {isEdit ? 'Enregistrer' : 'Créer le compte'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </PageLayout>
  );
}
