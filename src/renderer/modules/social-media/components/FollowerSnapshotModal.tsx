import { useEffect, useState } from 'react';
import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Textarea from '../../../shared/components/ui/Textarea';
import { useCrmAssignees } from '../../crm/hooks/useCrm';
import { usePlatforms, useUpsertSnapshot } from '../hooks/useSocialMedia';
import { useAuthStore } from '../../../shared/stores/auth.store';
import type { SocialFollowerSnapshot } from '../types/social-media.types';

interface Props {
  open: boolean;
  onClose: () => void;
  defaultPlatformId?: number;
  /** Relevé à modifier — plateforme et date verrouillées (l'upsert doit cibler la même ligne). */
  snapshot?: SocialFollowerSnapshot | null;
}

const today = () => new Date().toISOString().slice(0, 10);

// Rôles pouvant choisir librement l'auteur du relevé (liste alimentée par
// crm:listAssignees, réservée à la vue complète CRM). Les autres rôles
// (ASSISTANTE_DIRECTION, AGENT_TECHNIQUE…) se voient attribuer d'office leur
// propre compte, sans sélection.
const FULL_ACCESS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

export default function FollowerSnapshotModal({ open, onClose, defaultPlatformId, snapshot }: Props) {
  const isEdit = !!snapshot;
  const currentUser = useAuthStore((s) => s.user);
  const isFullAccess = !!currentUser && FULL_ACCESS_ROLES.includes(currentUser.role);

  // Toutes les plateformes (actives + inactives) : en modification, la
  // plateforme du relevé édité doit rester affichable même si elle a été
  // désactivée depuis ; en création, on ne propose que les plateformes actives.
  // Les plateformes de type « Site web » et « Autre » sont exclues : elles
  // n'ont pas de notion d'abonnés.
  const { data: platRes } = usePlatforms(true);
  const allPlatforms = (platRes?.success ? platRes.data ?? [] : []).filter(
    (p: any) => p.type !== 'WEBSITE' && p.type !== 'AUTRE'
  );
  const platforms = isEdit
    ? allPlatforms.filter((p: any) => p.isActive || p.id === snapshot?.platformId)
    : allPlatforms.filter((p: any) => p.isActive);
  const { data: usersRes } = useCrmAssignees(open && isFullAccess);
  const users: Array<{ id: number; firstName: string; lastName: string }> = usersRes?.success ? usersRes.data ?? [] : [];

  const upsert = useUpsertSnapshot();

  const [platformId, setPlatformId] = useState('');
  const [date, setDate] = useState(today());
  const [followersCount, setFollowersCount] = useState('');
  const [recordedById, setRecordedById] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (snapshot) {
      // Modification : plateforme et date verrouillées (l'upsert doit cibler
      // exactement la ligne éditée), le reste est préempli depuis le relevé.
      setPlatformId(String(snapshot.platformId));
      setDate(snapshot.date.slice(0, 10));
      setFollowersCount(String(snapshot.followersCount));
      setRecordedById(snapshot.recordedById ? String(snapshot.recordedById) : '');
      setNotes(snapshot.notes ?? '');
    } else {
      setPlatformId(defaultPlatformId ? String(defaultPlatformId) : '');
      setDate(today());
      setFollowersCount('');
      // Rôles restreints : le relevé est toujours attribué à l'utilisateur connecté.
      setRecordedById(!isFullAccess && currentUser ? String(currentUser.id) : '');
      setNotes('');
    }
    setError('');
  }, [open, snapshot, defaultPlatformId, isFullAccess, currentUser?.id]);

  const handleSubmit = async () => {
    if (!platformId) { setError('La plateforme est requise.'); return; }
    if (followersCount === '' || Number(followersCount) < 0) { setError('Le nombre d’abonnés est requis.'); return; }
    const r: any = await upsert.mutateAsync({
      platformId: Number(platformId),
      date,
      followersCount: Number(followersCount),
      recordedById: recordedById ? Number(recordedById) : null,
      notes: notes.trim() || undefined,
    });
    if (r.success) onClose();
    else setError(typeof r.error === 'string' ? r.error : 'Erreur lors de l’enregistrement');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Modifier le relevé' : 'Relevé du nombre d’abonnés'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button loading={upsert.isPending} onClick={handleSubmit}>Enregistrer</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Select label="Plateforme" required placeholder="Sélectionner…" disabled={isEdit}
          options={platforms.map((p: any) => ({ value: String(p.id), label: p.name }))}
          value={platformId}
          onChange={(e) => setPlatformId(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Date du relevé" type="date" required disabled={isEdit} value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Nombre d’abonnés" type="number" min={0} required value={followersCount}
            onChange={(e) => setFollowersCount(e.target.value)} />
        </div>
        {isEdit && (
          <p className="text-xs text-slate-400">
            La plateforme et la date ne sont pas modifiables (un seul relevé par plateforme et par jour).
          </p>
        )}
        {isFullAccess ? (
          <Select label="Relevé par" placeholder="Non renseigné"
            options={users.map((u) => ({ value: String(u.id), label: `${u.lastName} ${u.firstName}` }))}
            value={recordedById}
            onChange={(e) => setRecordedById(e.target.value)} />
        ) : (
          <Input label="Relevé par" value={currentUser ? `${currentUser.lastName} ${currentUser.firstName}` : ''} disabled />
        )}
        <Textarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!isEdit && (
          <p className="text-xs text-slate-400">
            Un seul relevé par plateforme et par jour : une nouvelle saisie à la même date remplace la précédente.
          </p>
        )}
      </div>
    </Modal>
  );
}
