import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { useOwner, useDeleteOwner, useOwnerPortfolio } from '../hooks/useOwners';
import { formatDate, formatCurrency } from '../../../shared/utils/format';
import { Edit, Trash2, Home, Building2, FileText, ExternalLink } from 'lucide-react';
import EntityDocumentsCard from '../../archiving/components/EntityDocumentsCard';

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

  const o = res?.data;
  const portfolio = portfolioRes?.data;
  if (isLoading) {
    return (
      <PageLayout title="Chargement…" breadcrumbs={[{ label: 'Propriétaires', to: '/owners' }, { label: '…' }]}>
        <Card><p className="text-sm text-slate-500">Chargement de la fiche…</p></Card>
      </PageLayout>
    );
  }
  if (!o) {
    const errMsg = res && !res.success
      ? (typeof res.error === 'string' ? res.error : 'Fiche inaccessible')
      : 'Propriétaire introuvable';
    return (
      <PageLayout title="Fiche propriétaire" breadcrumbs={[{ label: 'Propriétaires', to: '/owners' }, { label: 'Erreur' }]}>
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

  return (
    <PageLayout
      title={displayName}
      breadcrumbs={[{ label: 'Propriétaires', to: '/owners' }, { label: displayName }]}
      actions={
        <div className="flex gap-2">
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
                ['Téléphone', o.phone ?? '—'],
                ['Mobile', o.mobile ?? '—'],
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
