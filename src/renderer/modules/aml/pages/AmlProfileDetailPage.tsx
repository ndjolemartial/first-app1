import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Card from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Input from '../../../shared/components/ui/Input';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import { formatDate } from '../../../shared/utils/format';
import { useAuthStore } from '../../../shared/stores/auth.store';
import {
  useAmlProfile, useAmlRiskFactors, useSetAmlRiskFactors, useComputeAmlRisk,
  useValidateAmlProfile, useMarkAmlProfileToReview, useMarkAmlProfileRefused, useDeleteAmlProfile,
  useCreateBeneficialOwner, useDeleteBeneficialOwner,
  useScreenAmlWatchlist, useReviewAmlWatchlistMatch,
} from '../hooks/useAml';
import AmlRiskBadge from '../components/AmlRiskBadge';
import ReportSuspicionButton from '../components/ReportSuspicionButton';
import {
  PROFILE_STATUS_LABEL, PROFILE_STATUS_VARIANT, PEP_CATEGORY_LABEL, VIGILANCE_TYPE_LABEL,
  WATCHLIST_MATCH_STATUS_LABEL, WATCHLIST_MATCH_STATUS_VARIANT, subjectDisplayName,
} from '../utils/aml.utils';
import { Edit, RefreshCw, CheckCircle2, AlertCircle, XCircle, Trash2, Search, Plus, Paperclip } from 'lucide-react';

const AML_ROLES = ['SUPER_ADMIN', 'ADMIN', 'CONFORMITE', 'MANAGER', 'ACCOUNTANT'];
const ADMIN_ONLY = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

export default function AmlProfileDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token)!;
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const canWrite = AML_ROLES.includes(role);
  const canDelete = ADMIN_ONLY.includes(role);

  const { data, isLoading } = useAmlProfile(Number(id));
  const profile = data?.data;
  const { data: factorsData } = useAmlRiskFactors();
  const factors = factorsData?.data ?? [];

  const setRiskFactors = useSetAmlRiskFactors();
  const computeRisk = useComputeAmlRisk();
  const validate = useValidateAmlProfile();
  const markToReview = useMarkAmlProfileToReview();
  const markRefused = useMarkAmlProfileRefused();
  const del = useDeleteAmlProfile();
  const createBO = useCreateBeneficialOwner();
  const deleteBO = useDeleteBeneficialOwner();
  const screen = useScreenAmlWatchlist();
  const reviewMatch = useReviewAmlWatchlistMatch();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [boOpen, setBoOpen] = useState(false);
  const [boFirstName, setBoFirstName] = useState('');
  const [boLastName, setBoLastName] = useState('');
  const [boPct, setBoPct] = useState('');
  const [boRole, setBoRole] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const linkedFactorIds = useMemo(() => new Set<number>((profile?.riskFactorLinks ?? []).map((l: any) => l.riskFactorId as number)), [profile]);

  if (isLoading) return <PageLayout title="Profil LBC/FT"><SkeletonTable rows={10} /></PageLayout>;
  if (!profile) return <PageLayout title="Profil LBC/FT">Profil introuvable.</PageLayout>;

  const toggleFactor = (factorId: number) => {
    if (!canWrite) return;
    const current = new Set<number>(linkedFactorIds);
    if (current.has(factorId)) current.delete(factorId); else current.add(factorId);
    setRiskFactors.mutate({ id: profile.id, riskFactorIds: Array.from(current) });
  };

  const addBeneficialOwner = async () => {
    if (!boFirstName.trim() || !boLastName.trim()) return;
    const res: any = await createBO.mutateAsync({
      profileId: profile.id,
      payload: { firstName: boFirstName, lastName: boLastName, ownershipPct: boPct ? Number(boPct) : undefined, role: boRole || undefined },
    });
    if (res.success) { setBoOpen(false); setBoFirstName(''); setBoLastName(''); setBoPct(''); setBoRole(''); }
  };

  const uploadDocs = async (list: FileList | null) => {
    if (!list || !list.length) return;
    setUploading(true);
    const files = Array.from(list).map((f) => ({
      sourcePath: window.electron.documents.pathForFile(f),
      originalName: f.name, mimeType: f.type || 'application/octet-stream', size: f.size,
    }));
    const r: any = await window.electron.documents.import(token, { amlProfileId: profile.id, files });
    setUploading(false);
    if (r?.success) window.location.reload();
  };

  return (
    <PageLayout
      title={`Profil LBC/FT — ${subjectDisplayName(profile.subject)}`}
      breadcrumbs={[{ label: 'Conformité LBC/FT', to: '/aml/profiles' }, { label: 'Profils', to: '/aml/profiles' }, { label: profile.reference }]}
      actions={
        <div className="flex gap-2">
          <ReportSuspicionButton subjectType={profile.subjectType} subjectId={profile.subjectId} />
          {canWrite && (
            <Button variant="secondary" icon={<Edit className="h-4 w-4" />} onClick={() => navigate(`/aml/profiles/${profile.id}/edit`)}>
              Modifier
            </Button>
          )}
          {canDelete && (
            <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDelete(true)} />
          )}
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-xs text-slate-400">{profile.reference}</div>
              <div className="text-lg font-semibold text-slate-900">{subjectDisplayName(profile.subject)}</div>
              <div className="text-sm text-slate-500">{profile.subjectType === 'CLIENT' ? 'Client' : 'Propriétaire'}</div>
            </div>
            <div className="flex items-center gap-2">
              <AmlRiskBadge level={profile.riskLevel} />
              <Badge variant={PROFILE_STATUS_VARIANT[profile.status]}>{PROFILE_STATUS_LABEL[profile.status]}</Badge>
              {profile.isPep && <Badge variant="danger">PPE {profile.pepCategory ? `— ${PEP_CATEGORY_LABEL[profile.pepCategory]}` : ''}</Badge>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3 text-sm">
            <div><div className="text-slate-400">Score de risque</div><div className="font-semibold text-slate-900">{profile.riskScore}</div></div>
            <div><div className="text-slate-400">Vigilance</div><div className="font-semibold text-slate-900">{VIGILANCE_TYPE_LABEL[profile.vigilanceType]}</div></div>
            <div><div className="text-slate-400">Dernier calcul</div><div className="font-semibold text-slate-900">{profile.lastScoredAt ? formatDate(profile.lastScoredAt) : '—'}</div></div>
          </div>

          {canWrite && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" icon={<RefreshCw className="h-4 w-4" />} loading={computeRisk.isPending}
                onClick={() => computeRisk.mutate(profile.id)}>Recalculer le score</Button>
              <Button size="sm" variant="secondary" icon={<CheckCircle2 className="h-4 w-4" />} loading={validate.isPending}
                onClick={() => validate.mutate(profile.id)}>Valider</Button>
              <Button size="sm" variant="secondary" icon={<AlertCircle className="h-4 w-4" />} loading={markToReview.isPending}
                onClick={() => markToReview.mutate(profile.id)}>À revoir</Button>
              <Button size="sm" variant="secondary" icon={<XCircle className="h-4 w-4" />} loading={markRefused.isPending}
                onClick={() => markRefused.mutate(profile.id)}>Refuser</Button>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Facteurs de risque</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {factors.map((f: any) => (
                <label key={f.id} className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${linkedFactorIds.has(f.id) ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}>
                  <input type="checkbox" checked={linkedFactorIds.has(f.id)} disabled={!canWrite}
                    onChange={() => toggleFactor(f.id)} className="h-4 w-4 rounded border-slate-300" />
                  <span className="flex-1 text-slate-700">{f.label}</span>
                  <span className="text-xs text-slate-400">poids {f.weight}</span>
                  {f.isAutoDetected && <span className="text-xs text-slate-400">(auto)</span>}
                </label>
              ))}
            </div>
          </div>

          {(profile.sourceOfFunds || profile.sourceOfWealth) && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {profile.sourceOfFunds && <div><div className="text-slate-400">Origine des fonds</div><p className="text-slate-700">{profile.sourceOfFunds}</p></div>}
              {profile.sourceOfWealth && <div><div className="text-slate-400">Origine du patrimoine</div><p className="text-slate-700">{profile.sourceOfWealth}</p></div>}
            </div>
          )}
          {profile.notes && <div className="text-sm"><div className="text-slate-400">Notes</div><p className="text-slate-700">{profile.notes}</p></div>}
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Bénéficiaires effectifs</h3>
              {canWrite && <Button size="sm" variant="ghost" icon={<Plus className="h-4 w-4" />} onClick={() => setBoOpen((v) => !v)} />}
            </div>
            {(profile.beneficialOwners ?? []).length === 0 && !boOpen && <p className="text-xs italic text-slate-400">Aucun bénéficiaire effectif enregistré.</p>}
            <ul className="space-y-1.5">
              {(profile.beneficialOwners ?? []).map((bo: any) => (
                <li key={bo.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
                  <span>{bo.lastName} {bo.firstName}{bo.ownershipPct != null ? ` — ${bo.ownershipPct}%` : ''}{bo.role ? ` (${bo.role})` : ''}</span>
                  {canWrite && (
                    <button onClick={() => deleteBO.mutate({ id: bo.id, profileId: profile.id })} className="text-slate-400 hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {boOpen && (
              <div className="mt-2 space-y-2 rounded-lg border border-slate-200 p-2">
                <Input placeholder="Prénom" value={boFirstName} onChange={(e) => setBoFirstName(e.target.value)} />
                <Input placeholder="Nom" value={boLastName} onChange={(e) => setBoLastName(e.target.value)} />
                <Input placeholder="% détention" type="number" value={boPct} onChange={(e) => setBoPct(e.target.value)} />
                <Input placeholder="Rôle (gérant, associé…)" value={boRole} onChange={(e) => setBoRole(e.target.value)} />
                <Button size="sm" onClick={addBeneficialOwner} loading={createBO.isPending}>Ajouter</Button>
              </div>
            )}
          </Card>

          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Criblage listes de vigilance</h3>
              {canWrite && (
                <Button size="sm" variant="secondary" icon={<Search className="h-4 w-4" />} loading={screen.isPending}
                  onClick={() => screen.mutate(profile.id)}>Cribler</Button>
              )}
            </div>
            {(profile.watchlistMatches ?? []).length === 0 && <p className="text-xs italic text-slate-400">Aucune correspondance.</p>}
            <ul className="space-y-1.5">
              {(profile.watchlistMatches ?? []).map((m: any) => (
                <li key={m.id} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span>{m.watchlist?.name}</span>
                    <Badge variant={WATCHLIST_MATCH_STATUS_VARIANT[m.status]}>{WATCHLIST_MATCH_STATUS_LABEL[m.status]}</Badge>
                  </div>
                  {canWrite && m.status === 'A_VERIFIER' && (
                    <div className="mt-1 flex gap-2">
                      <Button size="sm" variant="danger" onClick={() => reviewMatch.mutate({ id: m.id, profileId: profile.id, payload: { status: 'CONFIRME' } })}>Confirmer</Button>
                      <Button size="sm" variant="secondary" onClick={() => reviewMatch.mutate({ id: m.id, profileId: profile.id, payload: { status: 'FAUX_POSITIF' } })}>Faux positif</Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Pièces justificatives</h3>
              {canWrite && (
                <Button size="sm" variant="ghost" icon={<Paperclip className="h-4 w-4" />} loading={uploading} onClick={() => fileInputRef.current?.click()} />
              )}
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { uploadDocs(e.target.files); e.target.value = ''; }} />
            </div>
            {(profile.documents ?? []).length === 0 && <p className="text-xs italic text-slate-400">Aucune pièce jointe.</p>}
            <ul className="space-y-1">
              {(profile.documents ?? []).map((d: any) => (
                <li key={d.id}>
                  <button className="text-sm text-blue-600 hover:underline" onClick={() => window.electron.documents.open(token, d.id)}>{d.name}</button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <ConfirmDialog open={confirmDelete} title="Supprimer le profil"
        message={`Supprimer le profil LBC/FT de « ${subjectDisplayName(profile.subject)} » ?`}
        onConfirm={async () => { await del.mutateAsync(profile.id); navigate('/aml/profiles'); }}
        onClose={() => setConfirmDelete(false)} />
    </PageLayout>
  );
}
