import { useEffect, useState } from 'react';
import Button from '../../../shared/components/ui/Button';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useAmlRiskThresholds, useUpdateAmlRiskThresholds } from '../../aml/hooks/useAml';
import { Save } from 'lucide-react';

const ADMIN_ONLY = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

export default function AmlThresholdsSettingsTab() {
  const { data } = useAmlRiskThresholds();
  const update = useUpdateAmlRiskThresholds();
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const canWrite = ADMIN_ONLY.includes(role);

  const [faibleMax, setFaibleMax] = useState('3');
  const [moyenMax, setMoyenMax] = useState('7');
  const [amountThreshold, setAmountThreshold] = useState('5000000');

  useEffect(() => {
    if (!data?.data) return;
    setFaibleMax(String(data.data.faibleMax));
    setMoyenMax(String(data.data.moyenMax));
    setAmountThreshold(String(data.data.amountThreshold));
  }, [data]);

  const save = () => {
    update.mutate({ faibleMax: Number(faibleMax), moyenMax: Number(moyenMax), amountThreshold: Number(amountThreshold) });
  };

  return (
    <div className="max-w-lg space-y-4">
      <p className="text-sm text-slate-500">
        Seuils utilisés par le moteur de scoring LBC/FT. ⚠️ Valeurs de référence indicatives, à valider avec le
        chargé de conformité désigné avant toute exploitation.
      </p>
      <Card className="space-y-3">
        <Input label="Score maximal — risque Faible" type="number" value={faibleMax} disabled={!canWrite}
          onChange={(e) => setFaibleMax(e.target.value)} helper="Un score inférieur ou égal classe le profil en risque Faible." />
        <Input label="Score maximal — risque Moyen" type="number" value={moyenMax} disabled={!canWrite}
          onChange={(e) => setMoyenMax(e.target.value)} helper="Au-delà, le profil est classé en risque Élevé." />
        <Input label="Seuil de montant « élevé » (FCFA)" type="number" value={amountThreshold} disabled={!canWrite}
          onChange={(e) => setAmountThreshold(e.target.value)} helper="Déclenche le facteur « Montant élevé » et une revue de transaction." />
        {canWrite && (
          <div className="flex justify-end">
            <Button icon={<Save className="h-4 w-4" />} loading={update.isPending} onClick={save}>Enregistrer</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
