import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Select from '../../../shared/components/ui/Select';
import { usePayrollAccountSetting, useUpdatePayrollAccount } from '../hooks/useSettings';

/**
 * Compte de trésorerie débité par défaut lors du paiement des salaires (RH/Paie).
 * Préremplit le champ « Compte débité » du modal de paiement d'un bulletin.
 * Seuls les comptes communs (non rattachés à un utilisateur) et actifs sont proposés.
 */
export default function PayrollAccountSettingsTab() {
  const { data: res, isLoading } = usePayrollAccountSetting();
  const update = useUpdatePayrollAccount();
  const [accountId, setAccountId] = useState('');

  useEffect(() => {
    if (res?.success && res.data) setAccountId(res.data.accountId != null ? String(res.data.accountId) : '');
  }, [res]);

  if (isLoading) return <Card>Chargement…</Card>;

  const accounts = res?.success ? (res.data?.accounts ?? []) : [];
  const options = [
    { value: '', label: '— Aucun compte par défaut —' },
    ...accounts.map((a) => ({ value: String(a.id), label: a.name })),
  ];

  const onSave = () => update.mutate({ accountId: accountId ? Number(accountId) : null });

  return (
    <Card>
      <h3 className="mb-4 font-semibold text-slate-700">Compte de paie (salaires)</h3>
      <p className="mb-4 text-sm text-slate-500">
        Compte de trésorerie présélectionné lors du paiement d'un bulletin de salaire. Le décaissement
        correspondant est enregistré en comptabilité sur ce compte. Seuls les comptes communs et actifs
        sont proposés.
      </p>
      <div className="max-w-md space-y-4">
        <Select
          label="Compte débité par défaut"
          options={options}
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        />
        {accounts.length === 0 && (
          <p className="text-xs text-amber-600">
            Aucun compte commun actif n'est disponible. Créez-en un dans « Comptes d'opérations ».
          </p>
        )}
        <div className="flex justify-end pt-2">
          <Button onClick={onSave} loading={update.isPending} icon={<Save className="h-4 w-4" />}>
            Enregistrer
          </Button>
        </div>
      </div>
    </Card>
  );
}
