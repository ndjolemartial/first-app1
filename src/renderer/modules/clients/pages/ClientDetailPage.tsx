import { useNavigate, useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import Select from '../../../shared/components/ui/Select';
import Input from '../../../shared/components/ui/Input';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import {
  useClient, useDeleteClient, useUpdateClientStatus,
  useAssignClient, useSetClientReferrer,
  useClientAssignableUsers, useClientReferrers,
  useCreateClientBeneficialOwner, useDeleteClientBeneficialOwner,
} from '../hooks/useClients';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { formatDate, formatCurrency, formatCivilite } from '../../../shared/utils/format';
import { useCountries } from '../../../shared/hooks/useCountries';
import { useCompanySettings, useLogoData } from '../../settings/hooks/useSettings';
import { buildClientKycDocumentHtml, buildClientKycFooterTemplate, formatSourceOfFunds, formatRelationshipPurpose } from '../utils/kycDocument';
import { formatBytes } from '../../archiving/utils/gedTree';
import { PEP_CATEGORY_LABEL } from '../../aml/utils/aml.utils';
import {
  Edit, Trash2, FileText, IdCard, Users, History, Printer, Building2, MapPin,
  UserCog, ShieldCheck, Mail, Phone, Landmark, Plus,
} from 'lucide-react';
import EntityDocumentsCard from '../../archiving/components/EntityDocumentsCard';
import AmlProfileLinkBadge from '../../aml/components/AmlProfileLinkBadge';
import ReportSuspicionButton from '../../aml/components/ReportSuspicionButton';

/** Affectation client : AD est explicitement exclue (réduite au niveau AGENT sur ce module). */
const ASSIGN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT']);

/**
 * Rôles autorisés à agir sur le bloc « Documents » (archiver, ouvrir). Les
 * autres rôles (AGENT, AGENT_TECHNIQUE, RH, READONLY) le consultent en lecture
 * seule. Inclut ASSISTANTE_DIRECTION, contrairement à {@link ASSIGN_ROLES}.
 */
const DOCUMENT_ACTION_ROLES = new Set([
  'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION',
]);

const STATUS_OPTIONS = [
  { value: 'ACTIF', label: 'Actif' },
  { value: 'INACTIF', label: 'Inactif' },
  { value: 'VIP', label: 'VIP' },
  { value: 'SUSPENDU', label: 'Suspendu' },
];

const STATUS_VARIANT: Record<string, 'success' | 'danger' | 'purple' | 'warning'> = {
  ACTIF: 'success',
  INACTIF: 'danger',
  VIP: 'purple',
  SUSPENDU: 'warning',
};

const CLIENT_TYPE_LABEL: Record<string, string> = {
  INDIVIDUEL: 'Personne physique',
  ENTREPRISE: 'Personne morale',
  ASSOCIATION_ONG: 'Association / ONG',
};

const STATUT_CONJUGAL_LABEL: Record<string, string> = {
  CELIBATAIRE: 'Célibataire', MARIEE: 'Marié(e)', CONCUBINAGE: 'Concubinage', DIVORCE: 'Divorcé(e)', VEUF: 'Veuf/Veuve',
};

/** Ligne « étiquette / valeur » réutilisée dans toutes les cartes d'information. */
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500 shrink-0">{label}</dt>
      <dd className="font-medium text-slate-900 text-right break-words">{value === null || value === undefined || value === '' ? '—' : value}</dd>
    </div>
  );
}

interface InfoCardProps {
  title: string;
  icon: React.ReactNode;
  /** `accent` distingue la carte Fiche KYC des autres, neutres. */
  tone?: 'neutral' | 'accent';
  children: React.ReactNode;
  className?: string;
}

/** Carte d'information réutilisable — même langage visuel que les sections du formulaire client. */
function InfoCard({ title, icon, tone = 'neutral', children, className }: InfoCardProps) {
  if (tone === 'accent') {
    return (
      <div className={clsx('rounded-xl border border-indigo-200 bg-indigo-50/40 shadow-sm p-6', className)}>
        <h3 className="font-semibold mb-4 flex items-center gap-2 text-indigo-900">
          <span className="text-indigo-600">{icon}</span>{title}
        </h3>
        {children}
      </div>
    );
  }
  return (
    <Card className={className}>
      <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
        <span className="text-slate-400">{icon}</span>{title}
      </h3>
      {children}
    </Card>
  );
}

/** Référence compacte à un document scanné (avec ouverture) — pièce d'identité, RC, justificatifs… */
function DocRow({ doc, token }: { doc: { id: number; name: string; size: number; uploadedAt: string }; token: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <FileText className="h-4 w-4 shrink-0 text-slate-400" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{doc.name}</p>
        <p className="text-xs text-slate-400">{formatBytes(doc.size)} — déposé le {formatDate(doc.uploadedAt)}</p>
      </div>
      <button type="button" className="text-xs font-medium text-blue-600 hover:underline shrink-0"
        onClick={() => window.electron.documents.open(token, doc.id)}>Ouvrir</button>
    </div>
  );
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: res, isLoading } = useClient(Number(id));
  const deleteClient = useDeleteClient();
  const updateStatus = useUpdateClientStatus();
  const assignClient   = useAssignClient();
  const setReferrer    = useSetClientReferrer();
  const role = useAuthStore((s) => s.user?.role) ?? '';
  const canAssign = ASSIGN_ROLES.has(role);
  // AGENT, ASSISTANTE_DIRECTION et READONLY ne peuvent pas modifier un client.
  const canWrite = ASSIGN_ROLES.has(role);
  const { data: assignableUsersRes } = useClientAssignableUsers();
  const { data: referrersRes }       = useClientReferrers();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exportingKyc, setExportingKyc] = useState(false);
  const token = useAuthStore((s) => s.token)!;
  const { data: companyRes } = useCompanySettings();
  const { data: logoRes } = useLogoData();
  const { data: countriesRes } = useCountries();
  // Code ISO → nom complet (« CI » → « Côte d'Ivoire »), pour la Fiche KYC imprimable.
  const countriesMap = useMemo<Record<string, string>>(() => {
    const list = (countriesRes?.data ?? []) as Array<{ isoCode: string; name: string }>;
    const map: Record<string, string> = {};
    for (const item of list) map[item.isoCode] = item.name;
    return map;
  }, [countriesRes]);
  const createBO = useCreateClientBeneficialOwner();
  const deleteBO = useDeleteClientBeneficialOwner();
  const [boOpen, setBoOpen] = useState(false);
  const [boFirstName, setBoFirstName] = useState('');
  const [boLastName, setBoLastName] = useState('');
  const [boNationality, setBoNationality] = useState('');
  const [boIdNumber, setBoIdNumber] = useState('');
  const [boPct, setBoPct] = useState('');
  const [boRole, setBoRole] = useState('');
  const [boIsPep, setBoIsPep] = useState(false);

  const c = res?.data;
  if (isLoading) {
    return (
      <PageLayout title="Chargement…" breadcrumbs={[{ label: 'Clients', to: '/clients' }, { label: '…' }]}>
        <Card><p className="text-sm text-slate-500">Chargement de la fiche…</p></Card>
      </PageLayout>
    );
  }
  if (!c) {
    const errMsg = res && !res.success
      ? (typeof res.error === 'string' ? res.error : 'Fiche inaccessible')
      : 'Client introuvable';
    return (
      <PageLayout title="Fiche client" breadcrumbs={[{ label: 'Clients', to: '/clients' }, { label: 'Erreur' }]}>
        <Card>
          <p className="text-sm text-red-600">{errMsg}</p>
          <button className="mt-3 text-sm text-blue-600 hover:underline" onClick={() => navigate('/clients')}>
            ← Retour à la liste
          </button>
        </Card>
      </PageLayout>
    );
  }

  const handlePrintKyc = async () => {
    if (!token) return;
    setExportingKyc(true);
    try {
      const company = companyRes?.success ? companyRes.data : null;
      const logo = logoRes?.success ? (logoRes.data as { mimeType: string; base64: string } | null) : null;
      const bodyHtml = buildClientKycDocumentHtml(c, company ?? null, logo, countriesMap);
      await window.electron.documentExport.printDocument(token, {
        fileName: `Fiche-KYC-${c.reference}`,
        bodyHtml,
        headerTemplate: '<div></div>',
        footerTemplate: buildClientKycFooterTemplate(company ?? null),
        headerMm: 6,
        footerMm: 20,
        marginsMm: { top: 20, bottom: 24, left: 18, right: 18 },
      });
    } finally {
      setExportingKyc(false);
    }
  };

  const formatUserName = (u: any) =>
    u ? `${u.lastName ?? ''} ${u.firstName ?? ''}`.trim() || u.email : '';
  const formatReferrerName = (r: any) =>
    r ? (r.companyName ?? `${r.lastName ?? ''} ${r.firstName ?? ''}`.trim()) : '';

  const addBeneficialOwner = async () => {
    if (!boFirstName.trim() || !boLastName.trim()) return;
    const res: any = await createBO.mutateAsync({
      clientId: c.id,
      payload: {
        firstName: boFirstName, lastName: boLastName,
        nationality: boNationality || undefined, idNumber: boIdNumber || undefined,
        ownershipPct: boPct ? Number(boPct) : undefined, role: boRole || undefined,
        isPep: boIsPep,
      },
    });
    if (res.success) {
      setBoOpen(false);
      setBoFirstName(''); setBoLastName(''); setBoNationality(''); setBoIdNumber('');
      setBoPct(''); setBoRole(''); setBoIsPep(false);
    }
  };

  const isIndividuel = c.type === 'INDIVIDUEL';
  const displayName = isIndividuel
    ? `${c.lastName ?? ''} ${c.firstName ?? ''}`.trim()
    : c.entreprise ?? '—';

  const docs: any[] = c.documents ?? [];
  const idDoc = docs.find((d) => d.category === 'identité');
  const rcDoc = docs.find((d) => d.category === 'registre_commerce');
  const legalRepIdDoc = docs.find((d) => d.category === 'piece_identite_rep_legal');
  const fundsProofDocs = docs.filter((d) => d.category === 'justificatif_origine_fonds');
  const genericDocs = docs.filter((d) => !['identité', 'registre_commerce', 'piece_identite_rep_legal', 'justificatif_origine_fonds'].includes(d.category));

  const hasKycInfo = Boolean(
    c.employerName || c.monthlyIncome != null
    || (Array.isArray(c.sourceOfFunds) && c.sourceOfFunds.length > 0) || c.sourceOfWealth
    || (Array.isArray(c.relationshipPurpose) && c.relationshipPurpose.length > 0)
    || c.expectedTransactionVolume != null || c.acquisitionChannel
    || c.isPep || c.hasRiskyCountryLink || c.kycSignedAt || c.kycSignedPlace
    || fundsProofDocs.length > 0
  );

  return (
    <PageLayout
      title={displayName}
      breadcrumbs={[{ label: 'Clients', to: '/clients' }, { label: displayName }]}
      actions={
        <div className="flex gap-2 items-end">
          {canWrite && (
            <div className="w-36">
              <Select
                label=""
                options={STATUS_OPTIONS}
                value={c.status ?? 'ACTIF'}
                disabled={updateStatus.isPending}
                onChange={(e) => updateStatus.mutate({ id: c.id, status: e.target.value })}
              />
            </div>
          )}
          <Button variant="secondary" icon={<History className="h-4 w-4" />}
            onClick={() => navigate(`/clients/${id}/timeline`)}>Fiche de suivi</Button>
          <Button variant="primary" icon={<Printer className="h-4 w-4" />} loading={exportingKyc}
            onClick={handlePrintKyc}>Fiche KYC</Button>
          <ReportSuspicionButton subjectType="CLIENT" subjectId={c.id} />
          {canWrite && (
            <>
              <Button variant="secondary" icon={<Edit className="h-4 w-4" />}
                onClick={() => navigate(`/clients/${id}/edit`)}>Modifier</Button>
              <Button variant="danger" icon={<Trash2 className="h-4 w-4" />}
                onClick={() => setConfirmDelete(true)}>Supprimer</Button>
            </>
          )}
        </div>
      }
    >
      <div className="max-w-4xl mx-auto space-y-4">
        <Card>
          <div className="flex items-start gap-4">
            <div className={clsx(
              'h-14 w-14 rounded-xl flex items-center justify-center text-xl font-bold shrink-0',
              isIndividuel ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'
            )}>
              {isIndividuel ? (displayName[0] ?? '?') : <Building2 className="h-6 w-6" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900 truncate">{displayName}</h2>
                {c.reference && (
                  <span className="font-mono text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                    {c.reference}
                  </span>
                )}
                <Badge variant={isIndividuel ? 'info' : 'purple'}>
                  {CLIENT_TYPE_LABEL[c.type] ?? c.type}
                </Badge>
                <Badge variant={STATUS_VARIANT[c.status] ?? 'default'}>
                  {STATUS_OPTIONS.find((o) => o.value === c.status)?.label ?? c.status ?? '—'}
                </Badge>
                {c.isPep && <Badge variant="danger">PPE</Badge>}
                <AmlProfileLinkBadge subjectType="CLIENT" subjectId={c.id} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                {c.email && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{c.email}</span>}
                {(c.phone || c.mobile) && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{[c.phone, c.mobile].filter(Boolean).join(' · ')}</span>}
                <span>Client depuis le {formatDate(c.createdAt)}</span>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          {isIndividuel ? (
            <InfoCard title="Identité" icon={<IdCard className="h-4 w-4" />}>
              <dl className="space-y-3 text-sm">
                <InfoRow label="Civilité" value={formatCivilite(c.civilite)} />
                <InfoRow label="Statut conjugal" value={c.statutConjugal ? (STATUT_CONJUGAL_LABEL[c.statutConjugal] ?? c.statutConjugal) : null} />
                <InfoRow label="Nationalité" value={c.nationality} />
                <InfoRow label="Date de naissance" value={c.birthDate ? formatDate(c.birthDate) : null} />
                <InfoRow label="Lieu de naissance" value={c.birthPlace} />
                <InfoRow label="Profession" value={c.profession} />
                <InfoRow label="Pièce d'identité" value={c.idType?.label && c.idNumber ? `${c.idType.label} — ${c.idNumber}` : (c.idNumber ?? null)} />
              </dl>
            </InfoCard>
          ) : (
            <InfoCard title={c.type === 'ASSOCIATION_ONG' ? 'Association / ONG' : 'Entreprise'} icon={<Building2 className="h-4 w-4" />}>
              <dl className="space-y-3 text-sm">
                <InfoRow label="Registre de commerce" value={c.registre_de_commerce} />
                <InfoRow label="Compte contribuable" value={c.compte_contribuable} />
                <InfoRow label="Site web" value={c.website} />
                <InfoRow label="Activités" value={c.companyActivity} />
              </dl>
              {rcDoc && <div className="mt-4"><DocRow doc={rcDoc} token={token} /></div>}
            </InfoCard>
          )}

          <InfoCard title="Coordonnées" icon={<MapPin className="h-4 w-4" />}>
            <dl className="space-y-3 text-sm">
              <InfoRow label="Email" value={c.email} />
              <InfoRow label="Téléphone 1" value={c.phone} />
              <InfoRow label="Téléphone 2" value={c.mobile} />
              <InfoRow label="Adresse" value={c.address} />
              <InfoRow label="Commune" value={c.commune} />
              <InfoRow label="Ville" value={c.city} />
              <InfoRow label="Pays" value={c.country} />
              {(c.smsOptOut || c.emailOptOut) && (
                <div className="pt-1">
                  <Badge variant="warning">Refuse les relances automatiques</Badge>
                </div>
              )}
            </dl>
          </InfoCard>

          {!isIndividuel && (
            <InfoCard title="Représentant légal" icon={<UserCog className="h-4 w-4" />}>
              <dl className="space-y-3 text-sm">
                <InfoRow label="Nom" value={[c.legalRepFirstName, c.legalRepLastName].filter(Boolean).join(' ')} />
                <InfoRow label="Contact" value={c.legalRepPhone} />
                <InfoRow label="Pièce d'identité" value={c.legalRepIdType?.label && c.legalRepIdNumber ? `${c.legalRepIdType.label} — ${c.legalRepIdNumber}` : (c.legalRepIdNumber ?? null)} />
              </dl>
              {legalRepIdDoc && <div className="mt-4"><DocRow doc={legalRepIdDoc} token={token} /></div>}
            </InfoCard>
          )}

          {!isIndividuel && (
            <InfoCard title="Bénéficiaires effectifs" icon={<Users className="h-4 w-4" />}>
              {(c.beneficialOwners ?? []).length === 0 && !boOpen && (
                <p className="text-sm italic text-slate-400">Aucun bénéficiaire effectif enregistré.</p>
              )}
              <ul className="space-y-1.5">
                {(c.beneficialOwners ?? []).map((bo: any) => (
                  <li key={bo.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium text-slate-900">{bo.lastName} {bo.firstName}</span>
                      {bo.ownershipPct != null && <span className="text-slate-500"> — {bo.ownershipPct}%</span>}
                      {bo.role && <span className="text-slate-500"> ({bo.role})</span>}
                      <div className="text-xs text-slate-400 mt-0.5">
                        {[bo.nationality, bo.idNumber].filter(Boolean).join(' — ')}
                        {bo.isPep && <Badge variant="danger" className="ml-2">PPE</Badge>}
                      </div>
                    </div>
                    {canWrite && (
                      <button onClick={() => deleteBO.mutate({ id: bo.id, clientId: c.id })} className="text-slate-400 hover:text-red-500 shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {canWrite && (
                boOpen ? (
                  <div className="mt-3 space-y-2 rounded-lg border border-slate-200 p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Prénom" value={boFirstName} onChange={(e) => setBoFirstName(e.target.value)} />
                      <Input placeholder="Nom" value={boLastName} onChange={(e) => setBoLastName(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Nationalité" value={boNationality} onChange={(e) => setBoNationality(e.target.value)} />
                      <Input placeholder="N° pièce d'identité" value={boIdNumber} onChange={(e) => setBoIdNumber(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="% détention" type="number" value={boPct} onChange={(e) => setBoPct(e.target.value)} />
                      <Input placeholder="Rôle (gérant, associé…)" value={boRole} onChange={(e) => setBoRole(e.target.value)} />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={boIsPep} onChange={(e) => setBoIsPep(e.target.checked)} />
                      Personne politiquement exposée (PPE)
                    </label>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button size="sm" variant="secondary" type="button" onClick={() => setBoOpen(false)}>Annuler</Button>
                      <Button size="sm" onClick={addBeneficialOwner} loading={createBO.isPending}>Ajouter</Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} className="mt-3" onClick={() => setBoOpen(true)}>
                    Ajouter un bénéficiaire effectif
                  </Button>
                )
              )}
            </InfoCard>
          )}

          {isIndividuel && (c.fatherFirstName || c.fatherLastName || c.motherFirstName || c.motherLastName) && (
            <InfoCard title="Filiation" icon={<Users className="h-4 w-4" />}>
              <dl className="space-y-3 text-sm">
                <InfoRow label="Père" value={[c.fatherFirstName, c.fatherLastName].filter(Boolean).join(' ')} />
                <InfoRow label="Mère" value={[c.motherFirstName, c.motherLastName].filter(Boolean).join(' ')} />
              </dl>
            </InfoCard>
          )}

          <InfoCard title="Affectation" icon={<Users className="h-4 w-4" />}>
            {canAssign ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">
                    Utilisateur référent
                  </label>
                  <Select
                    label=""
                    options={[
                      { value: '', label: '— Aucun —' },
                      ...((assignableUsersRes?.data ?? []) as any[]).map((u) => ({
                        value: String(u.id),
                        label: formatUserName(u),
                      })),
                    ]}
                    value={c.assignedToId != null ? String(c.assignedToId) : ''}
                    disabled={assignClient.isPending}
                    onChange={(e) =>
                      assignClient.mutate({
                        id: c.id,
                        assignedToId: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">
                    Apporteur d'affaire
                  </label>
                  <Select
                    label=""
                    options={[
                      { value: '', label: '— Aucun —' },
                      ...((referrersRes?.data ?? []) as any[]).map((r) => ({
                        value: String(r.id),
                        label: r.companyName
                          ? `${r.firstName ?? ''} ${r.lastName ?? ''} (${r.companyName})`.trim()
                          : `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim(),
                      })),
                    ]}
                    value={c.referrerId != null ? String(c.referrerId) : ''}
                    disabled={setReferrer.isPending}
                    onChange={(e) =>
                      setReferrer.mutate({
                        id: c.id,
                        referrerId: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
              </div>
            ) : (
              <dl className="space-y-3 text-sm">
                <InfoRow label="Utilisateur référent" value={c.assignedTo ? formatUserName(c.assignedTo) : null} />
                <InfoRow label="Apporteur" value={c.referrer ? formatReferrerName(c.referrer) : null} />
              </dl>
            )}
          </InfoCard>

          {c.prospect && (
            <InfoCard title="Origine" icon={<History className="h-4 w-4" />}>
              <p className="text-sm text-slate-600">
                Converti depuis un prospect —{' '}
                <button className="text-blue-600 hover:underline text-sm"
                  onClick={() => navigate(`/prospects/${c.prospect.id}`)}>
                  voir la fiche prospect
                </button>
              </p>
            </InfoCard>
          )}
        </div>

        {hasKycInfo && (
          <InfoCard tone="accent" title="Informations complémentaires — Fiche KYC" icon={<ShieldCheck className="h-4 w-4" />}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <dl className="space-y-3 col-span-2 sm:col-span-1">
                <InfoRow label="Employeur / activité" value={c.employerName} />
                <InfoRow label="Revenu mensuel déclaré" value={c.monthlyIncome != null ? formatCurrency(c.monthlyIncome) : null} />
                <InfoRow label="Origine du patrimoine" value={c.sourceOfWealth} />
                <InfoRow label="Volume mensuel estimé" value={c.expectedTransactionVolume != null ? formatCurrency(c.expectedTransactionVolume) : null} />
                <InfoRow label="Canal d'entrée en relation" value={c.acquisitionChannel} />
              </dl>
              <dl className="space-y-3 col-span-2 sm:col-span-1">
                <InfoRow label="Personne politiquement exposée" value={c.isPep ? <Badge variant="danger">Oui</Badge> : 'Non'} />
                {c.isPep && <InfoRow label="Catégorie PPE" value={c.pepCategory ? (PEP_CATEGORY_LABEL[c.pepCategory] ?? c.pepCategory) : null} />}
                {c.isPep && <InfoRow label="Fonction exercée" value={c.pepFunction} />}
                <InfoRow label="Lien avec un pays à risque" value={c.hasRiskyCountryLink ? <Badge variant="warning">Oui</Badge> : 'Non'} />
                <InfoRow label="Fiche signée le" value={c.kycSignedAt ? formatDate(c.kycSignedAt) : null} />
                <InfoRow label="Lieu de signature" value={c.kycSignedPlace} />
              </dl>
            </div>

            {(Array.isArray(c.sourceOfFunds) && c.sourceOfFunds.length > 0) && (
              <div className="mt-4 pt-4 border-t border-indigo-100">
                <p className="text-xs font-semibold text-indigo-900/70 uppercase tracking-wide mb-1">Origine des fonds</p>
                <p className="text-sm text-slate-700">{formatSourceOfFunds(c.sourceOfFunds, c.sourceOfFundsOther)}</p>
              </div>
            )}

            {(Array.isArray(c.relationshipPurpose) && c.relationshipPurpose.length > 0) && (
              <div className="mt-4 pt-4 border-t border-indigo-100">
                <p className="text-xs font-semibold text-indigo-900/70 uppercase tracking-wide mb-1">Objet de la relation d'affaires</p>
                <p className="text-sm text-slate-700">{formatRelationshipPurpose(c.relationshipPurpose, c.relationshipPurposeOther)}</p>
              </div>
            )}

            {fundsProofDocs.length > 0 && (
              <div className="mt-4 pt-4 border-t border-indigo-100">
                <p className="text-xs font-semibold text-indigo-900/70 uppercase tracking-wide mb-2">
                  Justificatif(s) d'origine des fonds ({fundsProofDocs.length})
                </p>
                <div className="space-y-2">
                  {fundsProofDocs.map((doc) => <DocRow key={doc.id} doc={doc} token={token} />)}
                </div>
              </div>
            )}
          </InfoCard>
        )}

        {c.conventions?.length > 0 && (
          <InfoCard title={`Conventions (${c.conventions.length})`} icon={<Landmark className="h-4 w-4" />}>
            <div className="space-y-2">
              {c.conventions.map((convention: any) => (
                <div key={convention.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-lg px-4 py-3">
                  <span className="font-medium">{convention.reference}</span>
                  <Badge variant={convention.status === 'ACTIVE' ? 'success' : 'default'}>{convention.status}</Badge>
                  <span className="text-slate-500">{convention.property?.address}, {convention.property?.city}</span>
                </div>
              ))}
            </div>
          </InfoCard>
        )}

        {isIndividuel && idDoc && (
          <InfoCard title="Pièce d'identité" icon={<IdCard className="h-4 w-4" />}>
            <DocRow doc={idDoc} token={token} />
          </InfoCard>
        )}

        {c.notes && (
          <InfoCard title="Notes" icon={<FileText className="h-4 w-4" />}>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{c.notes}</p>
          </InfoCard>
        )}

        <EntityDocumentsCard
          documents={genericDocs}
          defaultLinks={{ clientId: Number(id) }}
          invalidateKey={['clients', Number(id)]}
          canManage={DOCUMENT_ACTION_ROLES.has(role)}
        />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => { await deleteClient.mutateAsync(Number(id)); navigate('/clients'); }}
        loading={deleteClient.isPending}
        title="Supprimer le client"
        message={`Supprimer ${displayName} ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
      />
    </PageLayout>
  );
}
