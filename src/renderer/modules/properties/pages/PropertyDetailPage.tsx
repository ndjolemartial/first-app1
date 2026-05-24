import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../../../shared/components/layout/PageLayout';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Card from '../../../shared/components/ui/Card';
import { SkeletonTable } from '../../../shared/components/ui/Skeleton';
import LocationMap from '../../../shared/components/LocationMap';
import { useProperty, useUpdatePropertyStatus, useDeleteProperty } from '../hooks/useProperties';
import { toast } from '../../../shared/components/ui/Toast';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { formatDate, formatCurrency } from '../../../shared/utils/format';
import { Edit, Trash2, Building2, FileText, User } from 'lucide-react';
import { useState } from 'react';

const STATUS_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default' | 'purple'> = {
  DISPONIBLE: 'success', RESERVE: 'warning', SOUS_OPTION: 'warning', VENDU: 'default',
  EN_LOCATION: 'info', EN_RENOVATION: 'purple', INDISPONIBLE: 'danger',
};

const STATUS_LABEL: Record<string, string> = {
  DISPONIBLE: 'Disponible', RESERVE: 'Réservé', SOUS_OPTION: 'Sous option', VENDU: 'Vendu',
  EN_LOCATION: 'En location', EN_RENOVATION: 'En rénovation', INDISPONIBLE: 'Indisponible',
};

/** Statuts pour lesquels un client doit être rattaché. */
const STATUS_REQUIRING_CLIENT = new Set(['RESERVE', 'SOUS_OPTION', 'VENDU', 'EN_LOCATION']);

const CONVENTION_STATUS_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
  ACTIVE: 'success', BROUILLON: 'info', ATTENTE_SIGNATURE: 'warning',
  EXPIRE: 'danger', TERMINER: 'default', ANNULE: 'danger',
};

const TYPE_LABEL: Record<string, string> = {
  RENTAL_UNFURNISHED: 'Location non meublée', RENTAL_FURNISHED: 'Location meublée',
  SALE: 'Vente', MANAGEMENT: 'Gestion', COMMERCIAL_LEASE: 'Bail commercial',
};

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: res, isLoading } = useProperty(Number(id));
  const updateStatus = useUpdatePropertyStatus();
  const deleteProperty = useDeleteProperty();
  const [showDelete, setShowDelete] = useState(false);

  if (isLoading) return <div className="p-8"><SkeletonTable rows={6} /></div>;

  const p = res?.data;
  if (!p) return <div className="p-8 text-slate-500">Bien introuvable.</div>;

  const ownerName = p.owner?.companyName ?? `${p.owner?.firstName ?? ''} ${p.owner?.lastName ?? ''}`.trim();

  const handleDelete = async () => {
    const r = await deleteProperty.mutateAsync(Number(id));
    if (r.success) navigate('/properties');
    setShowDelete(false);
  };

  return (
    <PageLayout
      title={p.reference}
      breadcrumbs={[{ label: 'Biens', to: '/properties' }, { label: p.reference }]}
      actions={
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Edit className="h-4 w-4" />} onClick={() => navigate(`/properties/${id}/edit`)}>
            Modifier
          </Button>
          <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setShowDelete(true)}>
            Supprimer
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-6">
        {/* Colonne principale */}
        <div className="col-span-2 space-y-6">
          {/* Infos générales */}
          <Card>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{p.reference}</h2>
                  <p className="text-slate-500 text-sm">{p.address}{p.city ? `, ${p.city}` : ''}</p>
                </div>
              </div>
              <Badge variant={STATUS_VARIANT[p.status] ?? 'default'}>{STATUS_LABEL[p.status] ?? p.status}</Badge>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
              <div>
                <p className="text-xs text-slate-500 mb-1">Type</p>
                <p className="font-medium text-slate-800">{p.type}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Surface</p>
                <p className="font-medium text-slate-800">{p.surface != null ? `${p.surface} m²` : '—'}</p>
              </div>
              {p.rooms && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Pièces</p>
                  <p className="font-medium text-slate-800">{p.rooms}</p>
                </div>
              )}
              {p.bedrooms && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Chambres</p>
                  <p className="font-medium text-slate-800">{p.bedrooms}</p>
                </div>
              )}
              {p.floor !== null && p.floor !== undefined && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Étage</p>
                  <p className="font-medium text-slate-800">{p.floor}</p>
                </div>
              )}
              {p.buildYear && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Année</p>
                  <p className="font-medium text-slate-800">{p.buildYear}</p>
                </div>
              )}
              {p.condition && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">État</p>
                  <p className="font-medium text-slate-800">{p.condition}</p>
                </div>
              )}
              {p.garage && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Garage</p>
                  <p className="font-medium text-slate-800">{p.garage}</p>
                </div>
              )}
              {p.cuisine && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Cuisine</p>
                  <p className="font-medium text-slate-800">{p.cuisine}</p>
                </div>
              )}
              {p.terrasseBalcon && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Terrasse ou balcon</p>
                  <p className="font-medium text-slate-800">{p.terrasseBalcon}</p>
                </div>
              )}
            </div>

            {p.description && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-1">Description</p>
                <p className="text-slate-700 text-sm leading-relaxed">{p.description}</p>
              </div>
            )}
          </Card>

          {/* Localisation */}
          <LocationMap
            latitude={p.latitude}
            longitude={p.longitude}
            label={`${p.address ?? ''}${p.city ? `, ${p.city}` : ''}`.trim() || undefined}
          />

          {/* Conventions liées */}
          {(() => {
            const linkedConventions: any[] = (p.conventionLinks ?? [])
              .map((l: any) => l.convention)
              .filter(Boolean);
            return (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-500" /> Conventions ({linkedConventions.length})
                  </h3>
                  <Button size="sm" onClick={() => navigate('/conventions/new')}>Nouvelle convention</Button>
                </div>
                {linkedConventions.length === 0 ? (
                  <p className="text-slate-400 text-sm">Aucune convention pour ce bien.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-slate-600">Référence</th>
                        <th className="text-left px-3 py-2 font-medium text-slate-600">Type</th>
                        <th className="text-left px-3 py-2 font-medium text-slate-600">Client</th>
                        <th className="text-left px-3 py-2 font-medium text-slate-600">Début</th>
                        <th className="text-left px-3 py-2 font-medium text-slate-600">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {linkedConventions.map((c: any) => (
                        <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/conventions/${c.id}`)}>
                          <td className="px-3 py-2 font-medium text-slate-900">{c.reference}</td>
                          <td className="px-3 py-2 text-slate-600">{TYPE_LABEL[c.type] ?? c.type}</td>
                          <td className="px-3 py-2 text-slate-600">
                            {c.client?.type === 'INDIVIDUEL'
                              ? `${c.client?.firstName ?? ''} ${c.client?.lastName ?? ''}`.trim()
                              : c.client?.entreprise ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{formatDate(c.startDate)}</td>
                          <td className="px-3 py-2">
                            <Badge variant={CONVENTION_STATUS_VARIANT[c.status] ?? 'default'}>{c.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            );
          })()}
        </div>

        {/* Colonne latérale */}
        <div className="space-y-6">
          {/* Prix */}
          <Card>
            <h3 className="font-semibold text-slate-800 mb-3">Prix</h3>
            {p.rentPrice ? (
              <div className="mb-2">
                <p className="text-xs text-slate-500">Loyer mensuel</p>
                <p className="text-lg font-bold text-slate-900">{formatCurrency(Number(p.rentPrice))}</p>
                {p.charges ? <p className="text-xs text-slate-500">+ {formatCurrency(Number(p.charges))} charges</p> : null}
              </div>
            ) : null}
            {p.salePrice ? (
              <div>
                <p className="text-xs text-slate-500">Prix de vente</p>
                <p className="text-lg font-bold text-slate-900">{formatCurrency(Number(p.salePrice))}</p>
              </div>
            ) : null}
            {!p.rentPrice && !p.salePrice && <p className="text-slate-400 text-sm">Prix non renseigné</p>}
          </Card>

          {/* Origine du bien */}
          <Card>
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <User className="h-4 w-4 text-slate-500" /> Origine du bien
            </h3>
            {p.programme ? (
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Programme immobilier</p>
                <p className="font-medium text-slate-900">{p.programme.nom}</p>
                <p className="text-sm text-slate-500 font-mono">{p.programme.reference}</p>
                <Button variant="ghost" size="sm" className="mt-2 -ml-2"
                  onClick={() => navigate(`/programmes/${p.programme.id}`)}>
                  Voir le programme →
                </Button>
              </div>
            ) : p.owner ? (
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Propriétaire</p>
                <p className="font-medium text-slate-900">{ownerName}</p>
                {p.owner.phone && <p className="text-sm text-slate-500">{p.owner.phone}</p>}
                {p.owner.email && <p className="text-sm text-slate-500">{p.owner.email}</p>}
                <Button variant="ghost" size="sm" className="mt-2 -ml-2"
                  onClick={() => navigate(`/owners/${p.owner.id}`)}>
                  Voir le profil →
                </Button>
              </div>
            ) : (
              <p className="text-slate-400 text-sm">Non renseignée</p>
            )}
          </Card>

          {/* Client rattaché */}
          {p.client && (
            <Card>
              <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <User className="h-4 w-4 text-slate-500" /> Client rattaché
              </h3>
              <p className="font-medium text-slate-900">
                {p.client.type === 'ENTREPRISE'
                  ? p.client.entreprise ?? '—'
                  : `${p.client.firstName ?? ''} ${p.client.lastName ?? ''}`.trim() || '—'}
              </p>
              {p.client.phone && <p className="text-sm text-slate-500">{p.client.phone}</p>}
              {p.client.email && <p className="text-sm text-slate-500">{p.client.email}</p>}
              <Button variant="ghost" size="sm" className="mt-2 -ml-2"
                onClick={() => navigate(`/clients/${p.client.id}`)}>
                Voir le profil →
              </Button>
            </Card>
          )}

          {/* Statut rapide */}
          <Card>
            <h3 className="font-semibold text-slate-800 mb-3">Changer le statut</h3>
            <div className="flex flex-col gap-2">
              {['DISPONIBLE', 'RESERVE', 'SOUS_OPTION', 'VENDU', 'EN_RENOVATION', 'INDISPONIBLE'].map((s) => (
                <Button
                  key={s}
                  variant={p.status === s ? 'secondary' : 'ghost'}
                  size="sm"
                  disabled={p.status === s}
                  onClick={() => {
                    if (STATUS_REQUIRING_CLIENT.has(s) && !p.client) {
                      toast.error('Rattachez d\'abord un client via la page d\'édition pour ce statut');
                      return;
                    }
                    updateStatus.mutate({ id: Number(id), status: s });
                  }}
                >
                  {STATUS_LABEL[s]}
                </Button>
              ))}
            </div>
          </Card>

          {/* Métadonnées */}
          <Card>
            <h3 className="font-semibold text-slate-800 mb-3">Informations</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Référence</span>
                <span className="font-medium">{p.reference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Créé le</span>
                <span>{formatDate(p.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mis à jour</span>
                <span>{formatDate(p.updatedAt)}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={showDelete}
        title="Supprimer le bien"
        message={`Supprimer le bien ${p.reference} ? Cette action est irréversible.`}
        onConfirm={handleDelete}
        onClose={() => setShowDelete(false)}
      />
    </PageLayout>
  );
}
