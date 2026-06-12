import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import Button from '../../../shared/components/ui/Button';
import SearchSelect from '../../../shared/components/ui/SearchSelect';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { toast } from '../../../shared/components/ui/Toast';
import { formatCurrency } from '../../../shared/utils/format';
import {
  usePrepareInstallmentCommission,
  useCreateInstallmentCommission,
  useCommissions,
  useCommissionUsers,
} from '../../commissions/hooks/useCommissions';
import CommissionTable from '../../commissions/components/CommissionTable';
import {
  PayCommissionModal,
  CancelCommissionModal,
} from '../../commissions/components/CommissionModals';
import { TRANSACTION_TYPE_LABEL } from '../../commissions/utils/commissions.utils';

// Échéances héritées : seuls la souscription et les frais de démarches ACD sont
// applicables. Pour FRAIS_DEMARCHES_ACD, l'assiette (montant des frais) est saisie ;
// pour SOUSCRIPTION, l'assiette est le montant de l'échéance.
const TYPE_OPTIONS = ['SOUSCRIPTION', 'FRAIS_DEMARCHES_ACD'] as const;

/** Taux par défaut selon le type de commission (issu des paramètres). */
function defaultRateFor(type: string, rates: any): number {
  if (!rates) return 0;
  switch (type) {
    case 'LOCATION': return Number(rates.rentalRate ?? 0);
    case 'FRAIS_DOSSIER': return Number(rates.dossierRate ?? 0);
    default: return Number(rates.saleRate ?? 0); // VENTE, SOUSCRIPTION, FRAIS_DEMARCHES_ACD
  }
}

interface Props {
  installment: any;
  onClose: () => void;
}

/**
 * Gestion des commissions d'une échéance héritée (sans convention) :
 * bénéficiaire chargé depuis l'utilisateur référent du client, un type de
 * commission au plus par échéance, paiement / annulation des commissions.
 */
export default function InstallmentCommissionsModal({ installment, onClose }: Props) {
  const prepareQuery = usePrepareInstallmentCommission(installment.id);
  const listQuery = useCommissions({ installmentId: installment.id }, 1, 100);
  const createCommission = useCreateInstallmentCommission();
  const usersRes = useCommissionUsers();
  const users: any[] = usersRes.data?.success ? (usersRes.data.data ?? []) : [];
  const [payTarget, setPayTarget] = useState<any>(null);
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  // Bénéficiaire : champ de recherche, pré-rempli avec le référent du client.
  const [userId, setUserId] = useState<string>('');

  const prep = prepareQuery.data?.success ? prepareQuery.data.data : null;
  const referent = prep?.referentUser ?? null;
  const rates = prep?.rates ?? null;
  const existingTypes: string[] = prep?.existingTypes ?? [];
  // Assiette des frais de démarches ACD : somme des frais ACD des terrains
  // rattachés à l'échéance (calculée côté serveur). 0 si aucun terrain ACD.
  const acdBase = Number(prep?.acdBase ?? 0);
  const linkedTerrains: any[] = prep?.terrains ?? [];
  const commissions = listQuery.data?.success ? (listQuery.data.data ?? []) : [];

  // Assiette de la commission de souscription = montant encaissé (payé ou
  // partiellement payé). Le type n'est proposé que si quelque chose a été payé.
  const paidAmount = Number(installment.paidAmount ?? 0);
  const canSouscription = paidAmount > 0;

  const availableTypes = useMemo(
    () => TYPE_OPTIONS
      .filter((t) => !existingTypes.includes(t))
      .filter((t) => t !== 'SOUSCRIPTION' || canSouscription),
    [existingTypes, canSouscription],
  );

  // Pré-remplit le bénéficiaire avec le référent du client dès que le contexte
  // est chargé (l'utilisateur peut ensuite en choisir un autre via la recherche).
  useEffect(() => {
    if (referent?.id && !userId) setUserId(String(referent.id));
  }, [referent?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const userOptions = users.map((u: any) => ({
    value: String(u.id),
    label: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || `Utilisateur #${u.id}`,
  }));

  const { register, handleSubmit, watch, setValue, reset, formState: { isSubmitting } } = useForm({
    defaultValues: { transactionType: 'SOUSCRIPTION', rate: 0, notes: '' },
  });
  const selectedType = watch('transactionType');
  const isAcd = selectedType === 'FRAIS_DEMARCHES_ACD';
  const rate = Number(watch('rate')) || 0;
  const installmentAmount = Number(installment.amount);
  // Assiette : ACD → somme ACD des terrains ; souscription → montant encaissé.
  const baseAmount = isAcd ? acdBase : paidAmount;
  const computedAmount = Math.round(baseAmount * (rate / 100) * 100) / 100;

  // Garde le type sélectionné valide si la souscription devient indisponible.
  useEffect(() => {
    if (availableTypes.length > 0 && !availableTypes.includes(selectedType as any)) {
      setValue('transactionType', availableTypes[0]);
      setValue('rate', defaultRateFor(availableTypes[0], rates));
    }
  }, [availableTypes, selectedType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Aligne le taux par défaut sur le type sélectionné (sans écraser une saisie manuelle volontaire : on remet le défaut à chaque changement de type).
  const onTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const t = e.target.value;
    setValue('transactionType', t);
    setValue('rate', defaultRateFor(t, rates));
  };

  const onSubmit = async (data: any) => {
    if (!userId) { toast.error('Sélectionnez un utilisateur bénéficiaire'); return; }
    const acd = data.transactionType === 'FRAIS_DEMARCHES_ACD';
    if (acd && !(acdBase > 0)) {
      toast.error('Aucun frais ACD : rattachez à l\'échéance un terrain disposant de frais de démarches ACD (bouton « Modifier »).');
      return;
    }
    if (data.transactionType === 'SOUSCRIPTION' && !(paidAmount > 0)) {
      toast.error('Commission de souscription : l\'échéance doit être payée ou partiellement payée (assiette = montant encaissé).');
      return;
    }
    const r = await createCommission.mutateAsync({
      installmentId: installment.id,
      transactionType: data.transactionType,
      rate: Number(data.rate),
      // Bénéficiaire choisi (par défaut le référent du client).
      userId: Number(userId),
      // L'assiette ACD est recalculée côté serveur depuis les terrains rattachés.
      notes: data.notes || undefined,
    });
    if (r.success) {
      toast.success('Commission créée');
      reset({ transactionType: availableTypes[0] ?? 'SOUSCRIPTION', rate: 0, notes: '' });
      prepareQuery.refetch();
      listQuery.refetch();
    } else {
      toast.error(typeof r.error === 'string' ? r.error : 'Échec de la création de la commission');
    }
  };

  const clientName = installment.client?.type === 'INDIVIDUEL'
    ? `${installment.client?.firstName ?? ''} ${installment.client?.lastName ?? ''}`.trim()
    : (installment.client?.entreprise ?? '—');
  const referentName = referent ? `${referent.firstName} ${referent.lastName}`.trim() : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-bold text-slate-900">Commissions de l'échéance</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          {installment.detailsSouscription ?? installment.terrain?.reference ?? 'Échéance héritée'} — {clientName} — Échéance n°{installment.installmentNumber} — {formatCurrency(installmentAmount)}
        </p>

        {/* Bénéficiaire — champ de recherche, pré-rempli avec le référent du client */}
        <div className="mb-4">
          <SearchSelect
            label="Bénéficiaire"
            placeholder="Rechercher un utilisateur…"
            options={userOptions}
            value={userId}
            onChange={setUserId}
          />
          {referentName && (
            <p className="mt-1 text-xs text-slate-400">Pré-rempli avec le référent du client : {referentName}.</p>
          )}
        </div>

        {/* Souscription indisponible tant que rien n'est encaissé */}
        {userId && !canSouscription && !existingTypes.includes('SOUSCRIPTION') && (
          <p className="mb-3 text-xs text-amber-700">
            La commission de souscription sera disponible une fois l'échéance payée ou partiellement payée (l'assiette est le montant encaissé).
          </p>
        )}

        {/* Formulaire de création */}
        {userId && (
          availableTypes.length === 0 ? (
            <p className="text-sm text-slate-400 mb-4">
              {!canSouscription && !existingTypes.includes('SOUSCRIPTION')
                ? "Aucune commission applicable pour le moment (la souscription requiert un encaissement)."
                : 'Tous les types de commission ont déjà été passés sur cette échéance.'}
            </p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6 items-end">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Type de commission</label>
                <select
                  value={selectedType}
                  onChange={onTypeChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {availableTypes.map((t) => (
                    <option key={t} value={t}>{TRANSACTION_TYPE_LABEL[t] ?? t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Assiette{isAcd ? ' (frais ACD)' : ' (montant encaissé)'}
                </label>
                <div className="px-3 py-2 bg-slate-50 rounded-lg text-sm text-slate-600">
                  {formatCurrency(isAcd ? acdBase : paidAmount)}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Taux (%)</label>
                <input
                  type="number" step="0.01" min="0" max="100"
                  {...register('rate')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Montant commission</label>
                <div className="px-3 py-2 bg-slate-50 rounded-lg text-sm font-semibold text-slate-900">{formatCurrency(computedAmount)}</div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Notes (optionnel)</label>
                <input
                  type="text"
                  {...register('notes')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <Button type="submit" className="w-full" loading={isSubmitting || createCommission.isPending}>
                  Ajouter
                </Button>
              </div>
            </form>
          )
        )}

        {/* Frais de démarches ACD : rappel des terrains rattachés / assiette */}
        {userId && isAcd && (
          acdBase > 0 ? (
            <div className="-mt-3 mb-6 text-xs text-slate-500">
              Assiette ACD calculée depuis {linkedTerrains.length} terrain(s) rattaché(s) :{' '}
              {linkedTerrains.map((t) => t.reference).join(', ')} — total {formatCurrency(acdBase)}.
            </div>
          ) : (
            <div className="-mt-3 mb-6 text-xs text-amber-700">
              Aucun frais de démarches ACD sur les terrains rattachés. Utilisez « Modifier » pour rattacher un terrain disposant de frais ACD.
            </div>
          )
        )}

        {/* Commissions existantes */}
        <h3 className="font-semibold text-slate-800 mb-2 text-sm">Commissions passées</h3>
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          {listQuery.isLoading ? (
            <div className="p-4"><SkeletonTable rows={2} /></div>
          ) : (
            <CommissionTable
              commissions={commissions}
              showBeneficiary
              canManage
              onPay={setPayTarget}
              onCancel={setCancelTarget}
              emptyMessage="Aucune commission sur cette échéance."
            />
          )}
        </div>

        <div className="flex justify-end mt-5">
          <Button variant="secondary" onClick={onClose}>Fermer</Button>
        </div>
      </div>

      {payTarget && (
        <PayCommissionModal
          commission={payTarget}
          onClose={() => setPayTarget(null)}
          onSuccess={() => { setPayTarget(null); listQuery.refetch(); }}
        />
      )}
      {cancelTarget && (
        <CancelCommissionModal
          commission={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onSuccess={() => { setCancelTarget(null); prepareQuery.refetch(); listQuery.refetch(); }}
        />
      )}
    </div>
  );
}
