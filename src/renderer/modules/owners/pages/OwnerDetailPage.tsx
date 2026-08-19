import { useNavigate, useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import Input from '../../../shared/components/ui/Input';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import {
  useOwner, useDeleteOwner, useOwnerPortfolio,
  useCreateOwnerBeneficialOwner, useDeleteOwnerBeneficialOwner,
} from '../hooks/useOwners';
import { useAuthStore } from '../../../shared/stores/auth.store';
import { formatDate, formatCurrency } from '../../../shared/utils/format';
import { useCountries } from '../../../shared/hooks/useCountries';
import { useCompanySettings, useLogoData } from '../../settings/hooks/useSettings';
import { buildOwnerKycDocumentHtml, buildOwnerKycFooterTemplate, formatSourceOfFunds, formatRelationshipPurpose } from '../utils/kycDocument';
import { useKycAccess } from '../../../shared/hooks/useKycAccess';
import { PEP_CATEGORY_LABEL } from '../../aml/utils/aml.utils';
import { Edit, Trash2, Home, Building2, FileText, Printer, ShieldCheck, Users, Plus } from 'lucide-react';
import EntityDocumentsCard from '../../archiving/components/EntityDocumentsCard';
import AmlProfileLinkBadge from '../../aml/components/AmlProfileLinkBadge';
import ReportSuspicionButton from '../../aml/components/ReportSuspicionButton';

const PROPERTY_STATUS_VARIANT: Record<string, any> = {
  DISPONIBLE: 'success', RESERVE: 'warning', SOUS_OPTION: 'warning', VENDU: 'default',
  EN_LOCATION: 'info', EN_RENOVATION: 'warning', INDISPONIBLE: 'danger',
};

const DOC_CATEGORY_LABEL: Record<string, string> = {
  piece_identite: "Pièce d'identité",
  piece_identite_rep_legal: "Pièce d'identité représentant légal",
  registre_commerce: 'Registre de commerce',
};

export default function OwnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: res, isLoading } = useOwner(Number(id));
  const { data: portfolioRes } = useOwnerPortfolio(Number(id));
  const deleteOwner = useDeleteOwner();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exportingKyc, setExportingKyc] = useState(false);
  const token = useAuthStore((s) => s.token)!;
  const hasKycAccess = useKycAccess();
  const { data: companyRes } = useCompanySettings();
  const { data: logoRes } = useLogoData();
  const { data: countriesRes } = useCountries();
  const countriesMap = useMemo<Record<string, string>>(() => {
    const list = (countriesRes?.data ?? []) as Array<{ isoCode: string; name: string }>;
    const map: Record<string, string> = {};
    for (const item of list) map[item.isoCode] = item.name;
    return map;
  }, [countriesRes]);
  const createBO = useCreateOwnerBeneficialOwner();
  const deleteBO = useDeleteOwnerBeneficialOwner();
  const [boOpen, setBoOpen] = useState(false);
  const [boFirstName, setBoFirstName] = useState('');
  const [boLastName, setBoLastName] = useState('');
  const [boNationality, setBoNationality] = useState('');
  const [boIdNumber, setBoIdNumber] = useState('');
  const [boPct, setBoPct] = useState('');
  const [boRole, setBoRole] = useState('');
  const [boIsPep, setBoIsPep] = useState(false);

  const o = res?.data;
  const portfolio = portfolioRes?.data;
  if (isLoading) {
    return (
      <PageLayout title="Chargement…" breadcrumbs={[{ label: 'Tierce partie' }, { label: 'Propriétaires', to: '/owners' }, { label: '…' }]}>
        <Card><p className="text-sm text-slate-500">Chargement de la fiche…</p></Card>
      </PageLayout>
    );
  }
  if (!o) {
    const errMsg = res && !res.success
      ? (typeof res.error === 'string' ? res.error : 'Fiche inaccessible')
      : 'Propriétaire introuvable';
    return (
      <PageLayout title="Fiche propriétaire" breadcrumbs={[{ label: 'Tierce partie' }, { label: 'Propriétaires', to: '/owners' }, { label: 'Erreur' }]}>
        <Card>
          <p className="text-sm text-red-600">{errMsg}</p>
          <button className="mt-3 text-sm text-blue-600 hover:underline" onClick={() => navigate('/owners')}>
            ← Retour à la liste
          </button>
        </Card>
      </PageLayout>
    );
  }

  const displayName = o.type === 'INDIVIDUEL'
    ? `${o.lastName ?? ''} ${o.firstName ?? ''}`.trim()
    : o.companyName ?? '—';

  const docs: any[] = o.documents ?? [];
  const identityDocs = docs.filter((d: any) =>
    ['piece_identite', 'piece_identite_rep_legal', 'registre_commerce'].includes(d.category)
  );

  const handlePrintKyc = async () => {
    if (!token) return;
    setExportingKyc(true);
    try {
      const company = companyRes?.success ? companyRes.data : null;
      const logo = logoRes?.success ? (logoRes.data as { mimeType: string; base64: string } | null) : null;
      const bodyHtml = buildOwnerKycDocumentHtml(o, company ?? null, logo, countriesMap);
      await window.electron.documentExport.printDocument(token, {
        fileName: `Fiche-KYC-${displayName}`,
        bodyHtml,
        headerTemplate: '<div></div>',
        footerTemplate: buildOwnerKycFooterTemplate(company ?? null),
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
    const r: any = await createBO.mutateAsync({
      ownerId: o.id,
      payload: {
        firstName: boFirstName, lastName: boLastName,
        nationality: boNationality || undefined, idNumber: boIdNumber || undefined,
        ownershipPct: boPct ? Number(boPct) : undefined, role: boRole || undefined,
        isPep: boIsPep,
      },
    });
    if (r.success) {
      setBoOpen(false);
      setBoFirstName(''); setBoLastName(''); setBoNationality(''); setBoIdNumber('');
      setBoPct(''); setBoRole(''); setBoIsPep(false);
    }
  };

  const hasKycInfo = Boolean(
    o.employerName || o.monthlyIncome != null
    || (Array.isArray(o.sourceOfFunds) && o.sourceOfFunds.length > 0) || o.sourceOfWealth
    || (Array.isArray(o.relationshipPurpose) && o.relationshipPurpose.length > 0)
    || o.expectedTransactionVolume != null || o.acquisitionChannel
    || o.isPep || o.hasRiskyCountryLink || o.kycSignedAt || o.kycSignedPlace
  );

  return (
    <PageLayout
      title={displayName}
      breadcrumbs={[{ label: 'Tierce partie' }, { label: 'Propriétaires', to: '/owners' }, { label: displayName }]}
      actions={
        <div className="flex gap-2">
          {hasKycAccess && (
            <Button variant="primary" icon={<Printer className="h-4 w-4" />} loading={exportingKyc}
              onClick={handlePrintKyc}>Fiche KYC</Button>
          )}
          <ReportSuspicionButton subjectType="OWNER" subjectId={o.id} />
          <Button variant="secondary" icon={<Edit className="h-4 w-4" />}
            onClick={() => navigate(`/owners/${id}/edit`)}>Modifier</Button>
          <Button variant="danger" icon={<Trash2 className="h-4 w-4" />}
            onClick={() => setConfirmDelete(true)}>Supprimer</Button>
        </div>
      }
    >
      <div className="max-w-4xl mx-auto space-y-4">

        {/* En-tête */}
        <Card>
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-orange-100 flex items-center justify-center text-xl font-bold text-orange-700">
              {displayName[0] ?? '?'}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900">{displayName}</h2>
                <Badge variant={o.type === 'INDIVIDUEL' ? 'info' : 'purple'}>
                  {o.type === 'INDIVIDUEL' ? 'Particulier' : 'Entreprise'}
                </Badge>
                <Badge variant={o.isActive ? 'success' : 'danger'}>{o.isActive ? 'Actif' : 'Inactif'}</Badge>
                <AmlProfileLinkBadge subjectType="OWNER" subjectId={o.id} />
              </div>
              {o.email && <p className="text-slate-500 text-sm mt-0.5">{o.email}</p>}
            </div>
            {portfolio && (
              <div className="text-right">
                <p className="text-2xl font-bold text-green-600">{formatCurrency(portfolio.totalRentIncome)}</p>
                <p className="text-xs text-slate-500">Loyers mensuels actifs</p>
              </div>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          {/* Coordonnées */}
          <Card>
            <h3 className="font-semibold text-slate-700 mb-4">Coordonnées</h3>
            <dl className="space-y-3 text-sm">
              {[
                ['Téléphone 1', o.phone ?? '—'],
                ['Téléphone 2', o.mobile ?? '—'],
                ['Adresse', o.address ?? '—'],
                ['Ville', o.city ?? '—'],
                ['Pays', o.country],
                ['Créé le', formatDate(o.createdAt)],
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
                ['IBAN', o.bankIban ?? '—'],
                ['BIC', o.bankBic ?? '—'],
                ['Compte contribuable', o.compte_contribuable ?? '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-medium text-slate-900 font-mono text-xs">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>

        {/* Identité — Particulier */}
        {o.type === 'INDIVIDUEL' && o.idNumber && (
          <Card>
            <h3 className="font-semibold text-slate-700 mb-4">Pièce d'identité</h3>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between">
                <dt className="text-slate-500">Numéro</dt>
                <dd className="font-medium text-slate-900">{o.idNumber}</dd>
              </div>
            </dl>
          </Card>
        )}

        {/* Représentant légal — Entreprise */}
        {o.type === 'ENTREPRISE' && (
          <Card>
            <h3 className="font-semibold text-slate-700 mb-4">Représentant légal & Société</h3>
            <dl className="space-y-3 text-sm">
              {[
                ['Registre de commerce', o.registreCommerce ?? '—'],
                ['Nom', o.legalRepLastName ?? '—'],
                ['Prénom', o.legalRepFirstName ?? '—'],
                ['Contact', o.legalRepPhone ?? '—'],
                ["N° pièce d'identité", o.legalRepIdNumber ?? '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-medium text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        )}

        {/* Bénéficiaires effectifs — Entreprise */}
        {o.type === 'ENTREPRISE' && (
          <Card>
            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Users className="h-4 w-4" /> Bénéficiaires effectifs
            </h3>
            {(o.beneficialOwners ?? []).length === 0 && !boOpen && (
              <p className="text-sm italic text-slate-400">Aucun bénéficiaire effectif enregistré.</p>
            )}
            <ul className="space-y-1.5">
              {(o.beneficialOwners ?? []).map((bo: any) => (
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
                  <button onClick={() => deleteBO.mutate({ id: bo.id, ownerId: o.id })} className="text-slate-400 hover:text-red-500 shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            {boOpen ? (
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
                  ['Employeur / activité', o.employerName ?? '—'],
                  ['Revenu mensuel déclaré', o.monthlyIncome != null ? formatCurrency(o.monthlyIncome) : '—'],
                  ['Origine du patrimoine', o.sourceOfWealth ?? '—'],
                  ['Volume mensuel estimé', o.expectedTransactionVolume != null ? formatCurrency(o.expectedTransactionVolume) : '—'],
                  ["Canal d'entrée en relation", o.acquisitionChannel ?? '—'],
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
                  <dd className="font-medium text-slate-900 text-right">{o.isPep ? <Badge variant="danger">Oui</Badge> : 'Non'}</dd>
                </div>
                {o.isPep && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500 shrink-0">Catégorie PPE</dt>
                    <dd className="font-medium text-slate-900 text-right">{o.pepCategory ? (PEP_CATEGORY_LABEL[o.pepCategory] ?? o.pepCategory) : '—'}</dd>
                  </div>
                )}
                {o.isPep && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500 shrink-0">Fonction exercée</dt>
                    <dd className="font-medium text-slate-900 text-right">{o.pepFunction ?? '—'}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500 shrink-0">Lien avec un pays à risque</dt>
                  <dd className="font-medium text-slate-900 text-right">{o.hasRiskyCountryLink ? <Badge variant="warning">Oui</Badge> : 'Non'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500 shrink-0">Fiche signée le</dt>
                  <dd className="font-medium text-slate-900 text-right">{o.kycSignedAt ? formatDate(o.kycSignedAt) : '—'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500 shrink-0">Lieu de signature</dt>
                  <dd className="font-medium text-slate-900 text-right">{o.kycSignedPlace ?? '—'}</dd>
                </div>
              </dl>
            </div>

            {(Array.isArray(o.sourceOfFunds) && o.sourceOfFunds.length > 0) && (
              <div className="mt-4 pt-4 border-t border-indigo-100">
                <p className="text-xs font-semibold text-indigo-900/70 uppercase tracking-wide mb-1">Origine des fonds</p>
                <p className="text-sm text-slate-700">{formatSourceOfFunds(o.sourceOfFunds, o.sourceOfFundsOther)}</p>
              </div>
            )}

            {(Array.isArray(o.relationshipPurpose) && o.relationshipPurpose.length > 0) && (
              <div className="mt-4 pt-4 border-t border-indigo-100">
                <p className="text-xs font-semibold text-indigo-900/70 uppercase tracking-wide mb-1">Objet de la relation d'affaires</p>
                <p className="text-sm text-slate-700">{formatRelationshipPurpose(o.relationshipPurpose, o.relationshipPurposeOther)}</p>
              </div>
            )}
          </Card>
        )}

        {/* Documents */}
        {identityDocs.length > 0 && (
          <Card>
            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4" /> Documents joints
            </h3>
            <div className="space-y-2">
              {identityDocs.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-slate-400" />
                    <div>
                      <p className="font-medium text-slate-900">{doc.name}</p>
                      <p className="text-xs text-slate-500">
                        {DOC_CATEGORY_LABEL[doc.category] ?? doc.category} — {formatDate(doc.uploadedAt)}
                      </p>
                    </div>
                  </div>
                  <Badge variant="default">{(doc.size / 1024).toFixed(0)} Ko</Badge>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Portefeuille */}
        {o.properties?.length > 0 && (
          <Card>
            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Portefeuille ({o.properties.length} bien{o.properties.length > 1 ? 's' : ''})
            </h3>
            <div className="space-y-2">
              {o.properties.map((prop: any) => (
                <div key={prop.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-lg px-4 py-3 hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`/properties/${prop.id}`)}>
                  <div className="flex items-center gap-3">
                    <Home className="h-4 w-4 text-slate-400" />
                    <div>
                      <p className="font-medium text-slate-900">{prop.reference}</p>
                      <p className="text-xs text-slate-500">{prop.address}, {prop.city}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {prop.rentPrice && <span className="text-sm text-slate-600">{formatCurrency(prop.rentPrice)}/mois</span>}
                    <Badge variant={PROPERTY_STATUS_VARIANT[prop.status] ?? 'default'}>{prop.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {o.notes && (
          <Card>
            <h3 className="font-semibold text-slate-700 mb-2">Notes</h3>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{o.notes}</p>
          </Card>
        )}

        <EntityDocumentsCard
          documents={o.documents ?? []}
          defaultLinks={{ ownerId: Number(id) }}
          invalidateKey={['owners', Number(id)]}
        />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => { await deleteOwner.mutateAsync(Number(id)); navigate('/owners'); }}
        loading={deleteOwner.isPending}
        title="Supprimer le propriétaire"
        message={`Supprimer ${displayName} ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
      />
    </PageLayout>
  );
}
