import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../../shared/components/ui/Card';
import Badge from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import {
  useTreasuryAccounts,
  useDeleteTreasuryAccount,
} from '../../treasury/hooks/useTreasury';
import {
  ACCOUNT_TYPE_LABEL,
  ACCOUNT_TYPE_VARIANT,
} from '../../treasury/utils/treasury.utils';
import { formatCurrency } from '../../../shared/utils/format';
import { Plus, Pencil, Trash2, Landmark, Lock, Globe } from 'lucide-react';

/**
 * Onglet « Comptes d'opérations » dans Paramètres.
 * Liste les comptes de trésorerie et permet de les créer / modifier / supprimer.
 * Le formulaire reste hébergé dans le module Trésorerie (routes existantes)
 * mais avec des breadcrumbs adaptés au contexte Paramètres.
 */
export default function TreasuryAccountsSettingsTab() {
  const navigate = useNavigate();
  const { data: res, isLoading } = useTreasuryAccounts();
  const accounts: any[] = res?.data ?? [];
  const deleteAccount = useDeleteTreasuryAccount();
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const r = await deleteAccount.mutateAsync(deleteTarget.id);
    if (r.success) setDeleteTarget(null);
  };

  return (
    <Card>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Landmark className="h-4 w-4" /> Comptes d'opérations
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Comptes bancaires, caisses espèces et comptes Mobile Money sur lesquels
            sont enregistrées les opérations de trésorerie.
          </p>
        </div>
        <Button
          icon={<Plus className="h-4 w-4" />}
          onClick={() => navigate('/treasury/accounts/new?from=settings')}
        >
          Nouveau compte d'opérations
        </Button>
      </div>

      {isLoading ? (
        <SkeletonTable rows={5} />
      ) : accounts.length === 0 ? (
        <div className="py-16 text-center text-slate-400">
          Aucun compte d'opérations défini.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Libellé</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Type</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600">Banque / Opérateur</th>
              <th className="text-right px-3 py-2 font-medium text-slate-600">Solde</th>
              <th className="text-center px-3 py-2 font-medium text-slate-600">Accès</th>
              <th className="text-center px-3 py-2 font-medium text-slate-600">Statut</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {accounts.map((a: any) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-800">
                  <button
                    className="text-left hover:underline text-blue-700"
                    onClick={() => navigate(`/treasury/accounts/${a.id}`)}
                  >
                    {a.name}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <Badge variant={ACCOUNT_TYPE_VARIANT[a.type] ?? 'default'}>
                    {ACCOUNT_TYPE_LABEL[a.type] ?? a.type}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-slate-600">{a.bankName ?? '—'}</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-800">
                  {formatCurrency(Number(a.balance ?? a.initialBalance ?? 0))}
                </td>
                <td className="px-3 py-2 text-center">
                  {a.linkedUserId ? (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                      <Lock className="h-3 w-3" />
                      {a.linkedUser
                        ? `${a.linkedUser.firstName} ${a.linkedUser.lastName}`
                        : 'Privé'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <Globe className="h-3 w-3" /> Commun
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  <Badge variant={a.isActive ? 'success' : 'default'}>
                    {a.isActive ? 'Actif' : 'Inactif'}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm" variant="ghost"
                      icon={<Pencil className="h-4 w-4" />}
                      onClick={() => navigate(`/treasury/accounts/${a.id}/edit?from=settings`)}
                    />
                    <Button
                      size="sm" variant="ghost"
                      icon={<Trash2 className="h-4 w-4 text-red-500" />}
                      onClick={() => { deleteAccount.reset(); setDeleteTarget(a); }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Supprimer le compte d'opérations"
        message={
          `Supprimer « ${deleteTarget?.name ?? ''} » ? La suppression sera refusée ` +
          'si des opérations y sont enregistrées.'
        }
        confirmLabel="Supprimer"
        loading={deleteAccount.isPending}
      />
    </Card>
  );
}
