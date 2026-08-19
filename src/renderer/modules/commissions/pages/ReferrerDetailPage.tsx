import { useNavigate, useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { useAuthStore } from '../../../shared/stores/auth.store';
import {
  useReferrer, useDeleteReferrer,
  useCreateReferrerBeneficialOwner, useDeleteReferrerBeneficialOwner,
} from '../hooks/useCommissions';
import { referrerName, COMMISSION_WRITE_ROLES, COMMISSION_REFERRERS_DELETE_ROLES, COMMISSION_REFERRERS_FULL_VIEW_ROLES } from '../utils/commissions.utils';
import { formatDate, formatPersonName, formatCurrency } from '../../../shared/utils/format';
import { useCountries } from '../../../shared/hooks/useCountries';
import { useCompanySettings, useLogoData } from '../../settings/hooks/useSettings';
import { buildReferrerKycDocumentHtml, buildReferrerKycFooterTemplate, formatSourceOfFunds, formatRelationshipPurpose } from '../utils/referrerKycDocument';
import { PEP_CATEGORY_LABEL } from '../../aml/utils/aml.utils';
import { Edit, Trash2, Receipt, History, Printer, ShieldCheck, Users, Plus } from 'lucide-react';
import EntityDocumentsCard from '../../archiving/components/EntityDocumentsCard';

export default function ReferrerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role ?? '');
  const canManage = COMMISSION_WRITE_ROLES.includes(role);
  const canDelete = COMMISSION_REFERRERS_DELETE_ROLES.includes(role);
  const canViewCommissions = COMMISSION_REFERRERS_FULL_VIEW_ROLES.includes(role);

  const { data: res, isLoading } = useReferrer(Number(id));
  const deleteReferrer = useDeleteReferrer();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exportingKyc, setExportingKyc] = useState(false);
  const token = useAuthStore((s) => s.token)!;
  const { data: companyRes } = useCompanySettings();
  const { data: logoRes } = useLogoData();
  const { data: countriesRes } = useCountries();
  const countriesMap = useMemo<Record<string, string>>(() => {
    const list = (countriesRes?.data ?? []) as Array<{ isoCode: string; name: string }>;
    const map: Record<string, string> = {};
    for (const item of list) map[item.isoCode] = item.name;
    return map;
  }, [countriesRes]);
  const createBO = useCreateReferrerBeneficialOwner();
  const deleteBO = useDeleteReferrerBeneficialOwner();
  const [boOpen, setBoOpen] = useState(false);
  const [boFirstName, setBoFirstName] = useState('');
  const [boLastName, setBoLastName] = useState('');
  const [boNationality, setBoNationality] = useState('');
  const [boIdNumber, setBoIdNumber] = useState('');
  const [boPct, setBoPct] = useState('');
  const [boRole, setBoRole] = useState('');
  const [boIsPep, setBoIsPep] = useState(false);

  const r = res?.data;

  if (isLoading) {
    return (
      <PageLayout title="Chargement…" breadcrumbs={[{ label: 'Tierce partie' }, { label: 'Apporteurs d\'affaire', to: '/commissions/referrers' }, { label: '…' }]}>
        <Card><p className="text-sm text-slate-500">Chargement de la fiche…</p></Card>
      </PageLayout>
    );
  }
  if (!r) {
    const errMsg = res && !res.success
      ? (typeof res.error === 'string' ? res.error : 'Fiche inaccessible')
      : 'Apporteur d\'affaire introuvable';
    return (
      <PageLayout title="Fiche apporteur" breadcrumbs={[{ label: 'Tierce partie' }, { label: 'Apporteurs d\'affaire', to: '/commissions/referrers' }, { label: 'Erreur' }]}>
        <Card>
          <p className="text-sm text-red-600">{errMsg}</p>
          <button className="mt-3 text-sm text-blue-600 hover:underline" onClick={() => navigate('/commissions/referrers')}>
            ← Retour à la liste
          </button>
        </Card>
      </PageLayout>
    );
  }

  const displayName = referrerName(r);
  const personName = `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim();
  const isCompanyLike = Boolean(r.companyName);

  const handleDelete = async () => {
    const delRes = await deleteReferrer.mutateAsync(Number(id));
    if (delRes.success) navigate('/commissions/referrers');
  };
  const deleteError = deleteReferrer.data && !deleteReferrer.data.success ? deleteReferrer.data.error : null;

  const handlePrintKyc = async () => {
    if (!token) return;
    setExportingKyc(true);
    try {
      const company = companyRes?.success ? companyRes.data : null;
      const logo = logoRes?.success ? (logoRes.data as { mimeType: string; base64: string } | null) : null;
      const bodyHtml = buildReferrerKycDocumentHtml(r, company ?? null, logo, countriesMap);
      await window.electron.documentExport.printDocument(token, {
        fileName: `Fiche-KYC-${displayName}`,
        bodyHtml,
        headerTemplate: '<div></div>',
        footerTemplate: buildReferrerKycFooterTemplate(company ?? null),
        headerMm: 6,
        footerMm: 20,
        marginsMm: { top: 20, bottom: 24, left: 18, right: 18 },
      });
    } finally {
      setExportingKyc(false);
    }
  };

  const addBeneficialOwner = async () => {
    if (!boFirstName.trim() || !boLastName.trim()) return;
    const bres: any = await createBO.mutateAsync({
      referrerId: r.id,
      payload: {
        firstName: boFirstName, lastName: boLastName,
        nationality: boNationality || undefined, idNumber: boIdNumber || undefined,
        ownershipPct: boPct ? Number(boPct) : undefined, role: boRole || undefined,
        isPep: boIsPep,
      },
    });
    if (bres.success) {
      setBoOpen(false);
      setBoFirstName(''); setBoLastName(''); setBoNationality(''); setBoIdNumber('');
      setBoPct(''); setBoRole(''); setBoIsPep(false);
    }
  };

  const hasKycInfo = Boolean(
    r.employerName || r.monthlyIncome != null
    || (Array.isArray(r.sourceOfFunds) && r.sourceOfFunds.length > 0) || r.sourceOfWealth
    || (Array.isArray(r.relationshipPurpose) && r.relationshipPurpose.length > 0)
    || r.expectedTransactionVolume != null || r.acquisitionChannel
    || r.isPep || r.hasRiskyCountryLink || r.kycSignedAt || r.kycSignedPlace
  );

  return (
    <PageLayout
      title={displayName}
      breadcrumbs={[{ label: 'Tierce partie' }, { label: 'Apporteurs d\'affaire', to: '/commissions/referrers' }, { label: displayName }]}
      actions={
        <div className="flex gap-2">
          <Button variant="secondary" icon={<History className="h-4 w-4" />}
            onClick={() => navigate(`/commissions/referrers/${id}/timeline`)}>Fiche de suivi</Button>
          <Button variant="primary" icon={<Printer className="h-4 w-4" />} loading={exportingKyc}
            onClick={handlePrintKyc}>Fiche KYC</Button>
          {canViewCommissions && (
            <Button variant="secondary" icon={<Receipt className="h-4 w-4" />}
              onClick={() => navigate(`/commissions/beneficiary/REFERRER/${id}`)}>Commissions</Button>
          )}
          {canManage && (
            <Button variant="secondary" icon={<Edit className="h-4 w-4" />}
              onClick={() => navigate(`/commissions/referrers/${id}/edit`)}>Modifier</Button>
          )}
          {canDelete && (
            <Button variant="danger" icon={<Trash2 className="h-4 w-4" />}
              onClick={() => { deleteReferrer.reset(); setConfirmDelete(true); }}>Supprimer</Button>
          )}
        </div>
      }
    >
      <div className="max-w-4xl mx-auto space-y-4">

        {/* En-tête */}
        <Card>
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-indigo-100 flex items-center justify-center text-xl font-bold text-indigo-700">
              {displayName[0] ?? '?'}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900">{displayName}</h2>
                <Badge variant={r.isActive ? 'success' : 'danger'}>{r.isActive ? 'Actif' : 'Inactif'}</Badge>
              </div>
              {r.companyName && personName && (
                <p className="text-slate-500 text-sm mt-0.5">Contact : {personName}</p>
              )}
              {r.email && <p className="text-slate-500 text-sm mt-0.5">{r.email}</p>}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900">{r._count?.commissions ?? 0}</p>
              <p className="text-xs text-slate-500">Commission(s)</p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          {/* Coordonnées */}
          <Card>
            <h3 className="font-semibold text-slate-700 mb-4">Coordonnées</h3>
            <dl className="space-y-3 text-sm">
              {[
                ['Téléphone 1', r.phone ?? '—'],
                ['Téléphone 2', r.mobile ?? '—'],
                ['Adresse', r.address ?? '—'],
                ['Ville', r.city ?? '—'],
                ['Pays', r.country],
                ['Créé le', formatDate(r.createdAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-medium text-slate-900 text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {/* Infos bancaires */}
          <Card>
            <h3 className="font-semibold text-slate-700 mb-4">Informations bancaires</h3>
            <dl className="space-y-3 text-sm">
              {[
                ['IBAN', r.bankIban ?? '—'],
                ['BIC', r.bankBic ?? '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-medium text-slate-900 font-mono text-xs">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>

        {/* Affectation */}
        <Card>
          <h3 className="font-semibold text-slate-700 mb-4">Affectation</h3>
          <dl className="text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Utilisateur référent</dt>
              <dd className="font-medium text-slate-900">
                {r.assignedTo ? formatPersonName(r.assignedTo) : '—'}
              </dd>
            </div>
          </dl>
        </Card>

        {/* Bénéficiaires effectifs — Société */}
        {isCompanyLike && (
          <Card>
            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Users className="h-4 w-4" /> Bénéficiaires effectifs
            </h3>
            {(r.beneficialOwners ?? []).length === 0 && !boOpen && (
              <p className="text-sm italic text-slate-400">Aucun bénéficiaire effectif enregistré.</p>
            )}
            <ul className="space-y-1.5">
              {(r.beneficialOwners ?? []).map((bo: any) => (
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
                  {canManage && (
                    <button onClick={() => deleteBO.mutate(bo.id)} className="text-slate-400 hover:text-red-500 shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {canManage && (
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
          </Card>
        )}

        {/* Informations complémentaires — Fiche KYC */}
        {hasKycInfo && (
          <Card className="border-indigo-200 bg-indigo-50/40">
            <h3 className="font-semibold mb-4 flex items-center gap-2 text-indigo-900">
              <ShieldCheck className="h-4 w-4 text-indigo-600" /> Informations complémentaires — Fiche KYC
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <dl className="space-y-3 col-span-2 sm:col-span-1">
                {[
                  ['Employeur / activité', r.employerName ?? '—'],
                  ['Revenu mensuel déclaré', r.monthlyIncome != null ? formatCurrency(r.monthlyIncome) : '—'],
                  ['Origine du patrimoine', r.sourceOfWealth ?? '—'],
                  ['Volume mensuel estimé', r.expectedTransactionVolume != null ? formatCurrency(r.expectedTransactionVolume) : '—'],
                  ["Canal d'entrée en relation", r.acquisitionChannel ?? '—'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-slate-500 shrink-0">{label}</dt>
                    <dd className="font-medium text-slate-900 text-right break-words">{value}</dd>
                  </div>
                ))}
              </dl>
              <dl className="space-y-3 col-span-2 sm:col-span-1">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500 shrink-0">Personne politiquement exposée</dt>
                  <dd className="font-medium text-slate-900 text-right">{r.isPep ? <Badge variant="danger">Oui</Badge> : 'Non'}</dd>
                </div>
                {r.isPep && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500 shrink-0">Catégorie PPE</dt>
                    <dd className="font-medium text-slate-900 text-right">{r.pepCategory ? (PEP_CATEGORY_LABEL[r.pepCategory] ?? r.pepCategory) : '—'}</dd>
                  </div>
                )}
                {r.isPep && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500 shrink-0">Fonction exercée</dt>
                    <dd className="font-medium text-slate-900 text-right">{r.pepFunction ?? '—'}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500 shrink-0">Lien avec un pays à risque</dt>
                  <dd className="font-medium text-slate-900 text-right">{r.hasRiskyCountryLink ? <Badge variant="warning">Oui</Badge> : 'Non'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500 shrink-0">Fiche signée le</dt>
                  <dd className="font-medium text-slate-900 text-right">{r.kycSignedAt ? formatDate(r.kycSignedAt) : '—'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500 shrink-0">Lieu de signature</dt>
                  <dd className="font-medium text-slate-900 text-right">{r.kycSignedPlace ?? '—'}</dd>
                </div>
              </dl>
            </div>

            {(Array.isArray(r.sourceOfFunds) && r.sourceOfFunds.length > 0) && (
              <div className="mt-4 pt-4 border-t border-indigo-100">
                <p className="text-xs font-semibold text-indigo-900/70 uppercase tracking-wide mb-1">Origine des fonds</p>
                <p className="text-sm text-slate-700">{formatSourceOfFunds(r.sourceOfFunds, r.sourceOfFundsOther)}</p>
              </div>
            )}

            {(Array.isArray(r.relationshipPurpose) && r.relationshipPurpose.length > 0) && (
              <div className="mt-4 pt-4 border-t border-indigo-100">
                <p className="text-xs font-semibold text-indigo-900/70 uppercase tracking-wide mb-1">Objet de la relation d'affaires</p>
                <p className="text-sm text-slate-700">{formatRelationshipPurpose(r.relationshipPurpose, r.relationshipPurposeOther)}</p>
              </div>
            )}
          </Card>
        )}

        {r.notes && (
          <Card>
            <h3 className="font-semibold text-slate-700 mb-2">Notes</h3>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{r.notes}</p>
          </Card>
        )}

        <EntityDocumentsCard
          documents={r.documents ?? []}
          defaultLinks={{ referrerId: Number(id) }}
          invalidateKey={['commissions', 'referrer', Number(id)]}
        />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        loading={deleteReferrer.isPending}
        title="Supprimer l'apporteur d'affaire"
        message={
          deleteError && typeof deleteError === 'string'
            ? deleteError
            : `Supprimer ${displayName} ? Cette action est irréversible.`
        }
        confirmLabel="Supprimer"
      />
    </PageLayout>
  );
}
