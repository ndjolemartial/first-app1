import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import Modal from '../../../shared/components/ui/Modal';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useCommissionsDashboard, useUpdateCommissionSettings } from '../hooks/useCommissions';
import CommissionTable from '../components/CommissionTable';
import { BENEFICIARY_TYPE_LABEL, COMMISSION_ADMIN_ROLES } from '../utils/commissions.utils';
import { formatCurrency } from '../../../shared/utils/format';
import { Plus, Users, Wallet, CheckCircle, Ban, Settings, Percent } from 'lucide-react';

/** Modale de configuration des taux de commission par défaut. */
function SettingsModal({
  settings,
  onClose,
}: {
  settings: { saleRate: number; rentalRate: number; dossierRate: number };
  onClose: () => void;
}) {
  const update = useUpdateCommissionSettings();
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: {
      saleRate: settings.saleRate,
      rentalRate: settings.rentalRate,
      dossierRate: settings.dossierRate,
    },
  });
  const error = update.data && !update.data.success ? update.data.error : null;

  const onSubmit = async (data: any) => {
    const r = await update.mutateAsync({
      saleRate: Number(data.saleRate),
      rentalRate: Number(data.rentalRate),
      dossierRate: Number(data.dossierRate),
    });
    if (r.success) onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Taux de commission par défaut"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>Enregistrer</Button>
        </>
      }
    >
      <p className="text-sm text-slate-500 mb-4">
        Ces taux pré-remplissent les nouvelles commissions et sont appliqués automatiquement
        à l'activation d'un contrat de vente ou de location.
      </p>
      <form className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Taux pour les ventes (%)</label>
          <input
            type="number" step="0.01" min="0" max="100"
            {...register('saleRate')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-400 mt-1">Appliqué sur le prix de vente du contrat.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Taux pour les locations (%)</label>
          <input
            type="number" step="0.01" min="0" max="100"
            {...register('rentalRate')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-400 mt-1">Appliqué sur un mois de loyer.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Taux pour les frais d'ouverture de dossier (%)</label>
          <input
            type="number" step="0.01" min="0" max="100"
            {...register('dossierRate')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-400 mt-1">Appliqué sur le montant des frais d'ouverture de dossier.</p>
        </div>
        {error && <p className="text-xs text-red-600">{typeof error === 'string' ? error : 'Erreur lors de l\'enregistrement'}</p>}
      </form>
    </Modal>
  );
}

export default function CommissionsDashboardPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role ?? '');
  const isAdmin = COMMISSION_ADMIN_ROLES.includes(role);
  const [showSettings, setShowSettings] = useState(false);

  const { data: res, isLoading } = useCommissionsDashboard();
  const d = res?.data;

  return (
    <PageLayout
      title="Commissions"
      breadcrumbs={[{ label: 'Commissions' }]}
      actions={
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="secondary" icon={<Settings className="h-4 w-4" />} onClick={() => setShowSettings(true)}>
              Taux par défaut
            </Button>
          )}
          <Button variant="secondary" icon={<Users className="h-4 w-4" />} onClick={() => navigate('/commissions/referrers')}>
            Apporteurs d'affaire
          </Button>
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/commissions/new')}>
            Nouvelle commission
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="p-8"><SkeletonTable rows={6} /></div>
      ) : !d ? (
        <div className="p-8 text-slate-500">Données indisponibles.</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="flex items-center gap-4">
              <div className="rounded-xl bg-amber-50 p-3">
                <Wallet className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Commissions à payer</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(d.aPayerAmount)}</p>
                <p className="text-xs text-slate-400">{d.aPayerCount} commission(s)</p>
              </div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="rounded-xl bg-green-50 p-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Commissions payées</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(d.payeeAmount)}</p>
                <p className="text-xs text-slate-400">{d.payeeCount} commission(s)</p>
              </div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="rounded-xl bg-slate-100 p-3">
                <Ban className="h-6 w-6 text-slate-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Commissions annulées</p>
                <p className="text-xl font-bold text-slate-900">{d.annuleeCount}</p>
              </div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="rounded-xl bg-blue-50 p-3">
                <Percent className="h-6 w-6 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 mb-1">Taux par défaut</p>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Vente</span>
                    <span className="font-bold text-slate-900">{d.settings?.saleRate ?? 0} %</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Location</span>
                    <span className="font-bold text-slate-900">{d.settings?.rentalRate ?? 0} %</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Frais de dossier</span>
                    <span className="font-bold text-slate-900">{d.settings?.dossierRate ?? 0} %</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Récapitulatif par bénéficiaire */}
          <Card className="mb-6" padding={false}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Récapitulatif par bénéficiaire</h3>
              <Button variant="ghost" size="sm" onClick={() => navigate('/commissions/all')}>
                Toutes les commissions →
              </Button>
            </div>
            {(d.byBeneficiary ?? []).length === 0 ? (
              <p className="p-6 text-sm text-slate-400 text-center">Aucune commission enregistrée.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Bénéficiaire</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">À payer</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Payé</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {d.byBeneficiary.map((b: any) => (
                    <tr
                      key={`${b.beneficiaryType}-${b.beneficiaryId}`}
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() => navigate(`/commissions/beneficiary/${b.beneficiaryType}/${b.beneficiaryId}`)}
                    >
                      <td className="px-4 py-3 font-medium text-indigo-600">{b.name}</td>
                      <td className="px-4 py-3">
                        <Badge variant={b.beneficiaryType === 'USER' ? 'info' : 'purple'}>
                          {BENEFICIARY_TYPE_LABEL[b.beneficiaryType] ?? b.beneficiaryType}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-amber-600 font-medium">
                        {formatCurrency(b.aPayerAmount)}
                        <span className="text-xs text-slate-400 ml-1">({b.aPayerCount})</span>
                      </td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium">
                        {formatCurrency(b.payeAmount)}
                        <span className="text-xs text-slate-400 ml-1">({b.payeCount})</span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(b.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* Commissions récentes */}
          <Card padding={false}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Commissions récentes</h3>
              <Button variant="ghost" size="sm" onClick={() => navigate('/commissions/all')}>
                Voir tout →
              </Button>
            </div>
            <CommissionTable commissions={d.recent ?? []} emptyMessage="Aucune commission récente." />
          </Card>
        </>
      )}

      {showSettings && d && (
        <SettingsModal
          settings={d.settings ?? { saleRate: 0, rentalRate: 0, dossierRate: 0 }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </PageLayout>
  );
}
