import { useState } from 'react';
import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import Select from '../../../shared/components/ui/Select';
import Textarea from '../../../shared/components/ui/Textarea';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { useCreateAmlSuspiciousReport } from '../hooks/useAml';
import { REPORT_MOTIF_LABEL } from '../utils/aml.utils';
import { AlertTriangle } from 'lucide-react';

interface Props {
  subjectType: 'CLIENT' | 'OWNER';
  subjectId: number;
  conventionId?: number;
}

const READONLY_ROLE = 'READONLY';

/**
 * Bouton de signalement interne d'un soupçon LBC/FT, réutilisable depuis
 * les fiches Client/Owner/Convention. Ouvert à tous les rôles sauf READONLY
 * (exigence GAFI de remontée interne large). Le signalement, une fois
 * déposé, n'est plus consultable par son auteur (confidentialité stricte) —
 * seule une confirmation de dépôt est affichée.
 */
export default function ReportSuspicionButton({ subjectType, subjectId, conventionId }: Props) {
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const [open, setOpen] = useState(false);
  const [motifCategory, setMotifCategory] = useState('');
  const [motif, setMotif] = useState('');
  const create = useCreateAmlSuspiciousReport();

  if (role === READONLY_ROLE) return null;

  const submit = async () => {
    if (!motif.trim()) return;
    const res: any = await create.mutateAsync({
      subjectType, subjectId, conventionId: conventionId ?? undefined,
      motifCategory: motifCategory || undefined, motif: motif.trim(),
    });
    if (res.success) { setOpen(false); setMotif(''); setMotifCategory(''); }
  };

  return (
    <>
      <Button variant="danger" size="sm" icon={<AlertTriangle className="h-4 w-4" />} onClick={() => setOpen(true)}>
        Signaler un soupçon LBC/FT
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Signaler un soupçon LBC/FT"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button variant="danger" onClick={submit} disabled={!motif.trim() || create.isPending}>Envoyer le signalement</Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-500">
          Ce signalement est strictement confidentiel : il ne sera visible que du chargé de conformité
          et des administrateurs. Vous ne pourrez pas le relire une fois envoyé.
        </p>
        <div className="space-y-3">
          <Select
            label="Catégorie du motif (optionnel)"
            placeholder="Non catégorisé"
            options={Object.entries(REPORT_MOTIF_LABEL).map(([v, l]) => ({ value: v, label: l }))}
            value={motifCategory}
            onChange={(e) => setMotifCategory(e.target.value)}
          />
          <Textarea
            label="Motif du soupçon"
            required
            rows={5}
            placeholder="Décrivez précisément les éléments qui motivent ce signalement…"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
          />
        </div>
      </Modal>
    </>
  );
}
